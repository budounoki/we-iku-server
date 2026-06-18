import { useMemo } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/Navigation";
import { useLogs, useSettings } from "@/hooks/use-app-data";
import { motion } from "framer-motion";
import { Calendar, Camera, Heart, Star, ChevronRight } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Album() {
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: allLogs } = useLogs(familyId);
  const { data: settings } = useSettings(familyId);

  const activeChildId = localStorage.getItem("activeChildId") ? parseInt(localStorage.getItem("activeChildId")!) : null;
  const logs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);

  const milestones = logs?.filter((log: any) => log.type === 'milestone') || [];
  
  // チームパワー推移のデータ作成
  const birthday = settings?.babyBirthday ? parseISO(settings.babyBirthday) : subMonths(new Date(), 6);
  const months = eachMonthOfInterval({ start: birthday, end: new Date() });
  
  const chartData = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthLogs = logs?.filter((log: any) => {
      const d = new Date(log.createdAt);
      return d >= monthStart && d <= monthEnd;
    }) || [];
    
    const monthPoints = monthLogs.reduce((sum: number, log: any) => sum + (log.points || 0), 0);
    const monthThanks = monthLogs.filter((log: any) => log.type === 'thanks').length;
    
    return {
      name: format(month, 'M月'),
      power: Math.round((monthPoints + monthThanks * 5) / 30) || 0
    };
  });

  return (
    <div className="min-h-screen bg-white pb-24 font-sans">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <div className="px-8 py-10 bg-gradient-to-b from-purple-50 to-white">
          <h1 className="text-3xl font-black text-purple-900 mb-2">思い出アルバム</h1>
          <p className="text-sm font-bold text-purple-400">家族の歩んできた軌跡</p>
        </div>

        <main className="px-8 space-y-10">
          {/* チームパワー推移グラフ */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-purple-400 fill-purple-400" />
              <h2 className="text-xl font-black text-gray-800">チームパワーの歩み</h2>
            </div>
            <div className="h-64 w-full bg-gray-50 rounded-[2rem] p-4 border border-gray-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}
                    labelStyle={{fontWeight: 'black', color: '#6b21a8'}}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="power" 
                    stroke="#805AAA" 
                    strokeWidth={4} 
                    dot={{fill: '#805AAA', r: 6, strokeWidth: 3, stroke: '#fff'}}
                    activeDot={{r: 8, strokeWidth: 0}}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* はじめて記念日 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-red-400 fill-red-400" />
              <h2 className="text-xl font-black text-gray-800">はじめて記念日</h2>
            </div>
            <div className="space-y-4">
              {milestones.length > 0 ? milestones.map((m: any) => (
                <div key={m.id} className="bg-white rounded-3xl p-4 border-2 border-gray-50 flex items-center gap-4 shadow-sm hover:border-purple-100 transition-colors">
                  <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    📸
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-purple-400 uppercase">{format(new Date(m.createdAt), 'yyyy.MM.dd')}</p>
                    <p className="font-black text-gray-700">{m.message}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              )) : (
                <div className="bg-gray-50 rounded-[2rem] p-8 text-center border-2 border-dashed border-gray-200">
                  <p className="text-sm font-bold text-gray-400 leading-relaxed">
                    まだ記念日がありません。<br/>
                    ログ画面から「はじめて記念日」を記録してみましょう！
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
