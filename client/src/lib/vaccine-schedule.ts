// 予防接種カタログは web とアプリで共通化した（@shared/vaccine-schedule が唯一のソース）。
// 以前はこのファイルに実体があり、mobile 側と内容がずれていた。再エクスポートのみ。
export * from "@shared/vaccine-schedule";
