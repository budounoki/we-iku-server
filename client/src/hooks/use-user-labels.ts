import { useState, useEffect } from "react";

const PAPA_LABEL_KEY = "we_iku_papa_label";
const MAMA_LABEL_KEY = "we_iku_mama_label";
const EVENT_NAME = "we-iku-labels-changed";

export function useUserLabels() {
  const [papaLabel, setPapaLabelState] = useState(() =>
    localStorage.getItem(PAPA_LABEL_KEY) || "パパ"
  );
  const [mamaLabel, setMamaLabelState] = useState(() =>
    localStorage.getItem(MAMA_LABEL_KEY) || "ママ"
  );

  useEffect(() => {
    const handleChange = () => {
      setPapaLabelState(localStorage.getItem(PAPA_LABEL_KEY) || "パパ");
      setMamaLabelState(localStorage.getItem(MAMA_LABEL_KEY) || "ママ");
    };
    window.addEventListener(EVENT_NAME, handleChange);
    return () => window.removeEventListener(EVENT_NAME, handleChange);
  }, []);

  const getLabel = (userId: string): string => {
    if (userId === "papa") return papaLabel;
    if (userId === "mama") return mamaLabel;
    return "その他";
  };

  const setPapaLabel = (label: string) => {
    const clean = label.trim() || "パパ";
    localStorage.setItem(PAPA_LABEL_KEY, clean);
    setPapaLabelState(clean);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  };

  const setMamaLabel = (label: string) => {
    const clean = label.trim() || "ママ";
    localStorage.setItem(MAMA_LABEL_KEY, clean);
    setMamaLabelState(clean);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  };

  return { papaLabel, mamaLabel, getLabel, setPapaLabel, setMamaLabel };
}
