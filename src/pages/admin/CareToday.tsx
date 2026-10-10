// Today, for care coordinators: the day's visits and alerts, emergencies from
// the field, and the schedule behind them. Lagos time throughout.
import { useSearchParams } from "react-router-dom";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TodayBoard } from "@/components/admin/care/today/TodayBoard";
import { ScheduleTab } from "@/components/admin/care/today/ScheduleTab";

const CareToday = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "schedule" ? "schedule" : "today";
  const setTab = (t: string) => setParams(t === "today" ? {} : { tab: t }, { replace: true });

  return (
    <section className="w-full" aria-labelledby="care-today-title">
      <ConsolePageHeader
        id="care-today-title"
        title="Today"
        description="Visits, alerts and emergencies, and the schedule behind them. Times are Lagos time."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-6">
          <TodayBoard onOpenSchedule={() => setTab("schedule")} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-6">
          <ScheduleTab />
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default CareToday;
