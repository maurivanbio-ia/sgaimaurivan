import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Shield, AlertTriangle } from "lucide-react";

interface LicenseEvent {
  id: number;
  tipo: string;
  validade: string;
  empreendimentoNome: string;
  orgaoEmissor: string;
  eventType?: 'licenca' | 'demanda';
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function LicenseCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const { data: licenses = [], isLoading, error } = useQuery<LicenseEvent[]>({
    queryKey: ["/api/licencas/calendar", startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: async () => {
      const response = await fetch(
        `/api/licencas/calendar?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`,
        {
          credentials: 'include'
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const licensesByDate = useMemo(() => {
    const grouped: Record<string, LicenseEvent[]> = {};
    licenses.forEach(license => {
      const date = new Date(license.validade).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(license);
    });
    return grouped;
  }, [licenses]);

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    while (days.length < 42) { // 6 weeks × 7 days
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDayUrgency = (licenses: LicenseEvent[]) => {
    const today = new Date();
    let minDays = Infinity;
    
    licenses.forEach(license => {
      const expiryDate = new Date(license.validade);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < minDays) minDays = diffDays;
    });
    
    if (minDays < 0) return { level: 'expired', color: 'bg-red-500', textColor: 'text-red-500' };
    if (minDays <= 30) return { level: 'critical', color: 'bg-orange-500', textColor: 'text-orange-500' };
    if (minDays <= 60) return { level: 'warning', color: 'bg-yellow-500', textColor: 'text-yellow-500' };
    if (minDays <= 90) return { level: 'attention', color: 'bg-blue-500', textColor: 'text-blue-500' };
    return { level: 'normal', color: 'bg-green-500', textColor: 'text-green-500' };
  };

  const days = getDaysInMonth();
  const currentMonth = currentDate.getMonth();

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-6 w-6 text-primary" />
            Calendário de Vencimento de Licenças
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigateMonth('prev')}
              data-testid="calendar-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-2 bg-muted rounded-md min-w-[140px] text-center font-medium">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigateMonth('next')}
              data-testid="calendar-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Carregando calendário...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-destructive">Erro ao carregar licenças: {error.message}</div>
          </div>
        ) : (
          <TooltipProvider>
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Vencidas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span>≤ 30 dias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>≤ 60 dias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>≤ 90 dias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>&gt; 90 dias</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Week headers */}
                {WEEKDAYS.map(day => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-b">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {days.map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentMonth;
                  const isToday = day.toDateString() === new Date().toDateString();
                  const dayLicenses = licensesByDate[day.toDateString()] || [];
                  const urgency = dayLicenses.length > 0 ? getDayUrgency(dayLicenses) : null;
                  
                  return (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <div 
                          className={`
                            relative p-2 h-20 border border-border hover:bg-muted/50 transition-colors cursor-default
                            ${!isCurrentMonth ? 'text-muted-foreground bg-muted/20' : ''}
                            ${isToday ? 'bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary shadow-lg ring-2 ring-primary/30' : ''}
                          `}
                          data-testid={`calendar-day-${day.getDate()}`}
                        >
                          <div className={`text-sm font-medium mb-1 ${
                            isToday ? 'text-primary font-bold text-base bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center' : ''
                          }`}>
                            {day.getDate()}
                          </div>
                          
                          {dayLicenses.length > 0 && (
                            <div className="space-y-1">
                              <div className={`w-2 h-2 rounded-full ${urgency?.color} absolute top-1 right-1`}></div>
                              <div className="text-xs">
                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                  {dayLicenses.length}
                                </Badge>
                              </div>
                              {dayLicenses.slice(0, 2).map((license, i) => (
                                <div 
                                  key={i}
                                  className="text-xs truncate p-1 bg-background/80 rounded border"
                                >
                                  {license.tipo.substring(0, 10)}...
                                </div>
                              ))}
                              {dayLicenses.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{dayLicenses.length - 2} mais
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      
                      {dayLicenses.length > 0 && (
                        <TooltipContent className="max-w-sm">
                          <div className="space-y-2">
                            <div className="font-semibold flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {day.toLocaleDateString('pt-BR')}
                            </div>
                            {dayLicenses.map((license, i) => {
                              const daysToExpiry = Math.ceil(
                                (new Date(license.validade).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                              );
                              
                              return (
                                <div key={i} className="border-l-2 border-primary pl-2 text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Shield className="h-3 w-3 text-blue-600" />
                                    <span className="font-medium">{license.tipo}</span>
                                    {daysToExpiry <= 30 && (
                                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                                    )}
                                  </div>
                                  <div className="text-muted-foreground">
                                    <div><strong>Empreendimento:</strong> {license.empreendimentoNome}</div>
                                    <div><strong>Órgão:</strong> {license.orgaoEmissor}</div>
                                    <div className={`font-medium ${urgency?.textColor}`}>
                                      {daysToExpiry < 0 ? 'VENCIDA!' : 
                                       daysToExpiry === 0 ? 'VENCE HOJE!' :
                                       `${daysToExpiry} dias restantes`}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}