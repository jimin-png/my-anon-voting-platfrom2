// app/api/metrics/route.ts (Metric API 구현 코드)

import { NextResponse } from 'next/server';

const generateMetrics = () => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Prometheus 형식과 유사하게 텍스트를 구성합니다.
    let metrics = `# HELP node_uptime_seconds Uptime of the Node.js process\n`;
    metrics += `# TYPE node_uptime_seconds gauge\n`;
    metrics += `node_uptime_seconds ${uptime}\n\n`;

    metrics += `# HELP node_memory_usage_bytes Memory usage of the Node.js process\n`;
    metrics += `# TYPE node_memory_usage_bytes gauge\n`;
    metrics += `node_memory_usage_rss_bytes ${memoryUsage.rss}\n`;
    metrics += `node_memory_usage_heapTotal_bytes ${memoryUsage.heapTotal}\n`;
    metrics += `node_memory_usage_heapUsed_bytes ${memoryUsage.heapUsed}\n`;

    return metrics;
};


export async function GET() {
    try {
        const metricsData = generateMetrics();

        // 텍스트 형식으로 응답합니다.
        return new NextResponse(metricsData, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });

    } catch (error: unknown) {
        console.error('Metrics API Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            status: 'error',
            message: 'Failed to generate metrics.',
            details: errorMessage,
        }, { status: 500 });
    }
}