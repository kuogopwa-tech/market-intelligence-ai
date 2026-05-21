import { useGetAiStatus, getGetAiStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Cpu, Clock, AlertCircle } from "lucide-react";

export default function Settings() {
  const { data: status, isLoading } = useGetAiStatus({
    query: { queryKey: getGetAiStatusQueryKey(), refetchInterval: 10000 }
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground">Manage platform configurations and check system health</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            AI Backend Status
          </CardTitle>
          <CardDescription>Real-time connection status to the analysis engine</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${status.online ? 'bg-green-500 animate-pulse' : 'bg-destructive'}`} />
                  <div>
                    <div className="font-medium text-sm">Connection Status</div>
                    <div className="text-xs text-muted-foreground">{status.online ? 'Connected and processing' : 'Disconnected'}</div>
                  </div>
                </div>
                <Badge variant={status.online ? "default" : "destructive"}>
                  {status.online ? 'Online' : 'Offline'}
                </Badge>
              </div>

              {status.online && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 border border-border rounded-lg bg-card/50">
                    <Cpu className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Model</div>
                      <div className="font-mono mt-1">{status.model || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground mt-1">Provider: {status.provider || 'Internal'}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 border border-border rounded-lg bg-card/50">
                    <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Latency</div>
                      <div className="font-mono mt-1">{status.responseTimeMs} ms</div>
                      <div className="text-xs text-muted-foreground mt-1">API response time</div>
                    </div>
                  </div>
                </div>
              )}

              {status.error && (
                <div className="flex items-start gap-3 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">{status.error}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-destructive">Failed to fetch status</div>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center text-xs text-muted-foreground pt-8">
        <p>DerivAnalyst Platform v1.0.0</p>
        <p className="mt-1">All rights reserved. Not financial advice.</p>
      </div>
    </div>
  );
}