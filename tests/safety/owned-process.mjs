/*
 * Process cleanup for children this launcher created.  Never signal a PID
 * unless its Linux start-time still matches the child we spawned: a reused PID
 * must be treated as somebody else's process.
 */
import fs from "node:fs";
import { once } from "node:events";

function readStartTime(pid) {
  if (process.platform !== "linux" || !Number.isInteger(pid) || pid <= 1) return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const closingParen = stat.lastIndexOf(")");
    const startTime = stat.slice(closingParen + 2).trim().split(/\s+/)[19];
    return startTime || null;
  } catch {
    return null;
  }
}

function hasOwnedSessionMember(record) {
  try {
    return fs.readdirSync("/proc").some((entry) => {
      if (!/^\d+$/.test(entry)) return false;
      try {
        const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
        const close = stat.lastIndexOf(")");
        const fields = stat.slice(close + 2).trim().split(/\s+/);
        // The slice starts at original field 3. Original process-group and
        // session are fields 5 and 6, indices 2 and 3 respectively.
        return Number(fields[2]) === record.pid && Number(fields[3]) === record.pid;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function trackOwnedProcess(child) {
  if (!child?.pid) throw new Error("managed child did not have a pid");
  const startTime = readStartTime(child.pid);
  if (!startTime) throw new Error("managed child ownership could not be established");
  return Object.freeze({ child, pid: child.pid, startTime });
}

export function isStillOwnedProcess(record) {
  return Boolean(record && record.child.exitCode === null && readStartTime(record.pid) === record.startTime);
}

async function waitForClose(child, timeoutMs) {
  if (child.exitCode !== null) return;
  await Promise.race([
    once(child, "close"),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function stopOwnedProcess(record, timeoutMs = 8_000) {
  const leaderIsStillOwned = isStillOwnedProcess(record);
  // A normally-exiting direct child can leave a server/test grandchild in its
  // detached session. The session id and process group were allocated by this
  // exact child PID; require both before signalling the group. This lets us
  // reap owned descendants without ever scanning/killing an arbitrary PID.
  if (!leaderIsStillOwned && !hasOwnedSessionMember(record)) return;
  try {
    // Every managed child is spawned detached, so this closes its exact,
    // private process group (test grandchildren included). A live leader's
    // start-time was checked above; for an exited leader the surviving members
    // must still prove the original private session/group identity.
    process.kill(-record.pid, "SIGTERM");
  } catch (error) {
    if (error?.code === "ESRCH") return;
    throw new Error("managed child could not be terminated");
  }
  await waitForClose(record.child, timeoutMs);
  if (!hasOwnedSessionMember(record)) return;
  try {
    process.kill(-record.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw new Error("managed child could not be killed");
  }
  await waitForClose(record.child, 2_000);
  if (hasOwnedSessionMember(record)) throw new Error("managed child did not exit");
}