import { useCallback, useEffect, useMemo, useState } from "react";
import { coachWeather, studentWeather } from "@/lib/bookme/weather-api";
import type { LessonWeatherView } from "@/lib/bookme/weather-service";

function useWeather(load: () => Promise<{ ok: boolean; lessons: LessonWeatherView[] }>) {
  const [lessons, setLessons] = useState<LessonWeatherView[]>([]);
  const reload = useCallback(() => {
    return load()
      .then((res) => {
        if (res.ok) setLessons(res.lessons);
      })
      .catch(() => undefined);
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const byId = useMemo(() => Object.fromEntries(lessons.map((lesson) => [lesson.lessonId, lesson])), [lessons]);
  return { byId, reload };
}

export function useCoachWeather() {
  return useWeather(coachWeather);
}

export function useStudentWeather() {
  return useWeather(studentWeather);
}
