export interface LayerConfig {
    id: string;
    url: string;
    intervalMs: number;
    enabled: boolean;
}
export interface LayerSnapshot {
    layerId: string;
    data: unknown;
    timestamp: string;
}
export interface LayerUpdateMessage {
    layerId: string;
    data: unknown;
    timestamp: string;
}
