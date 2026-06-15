import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MeasurementSystem } from "@/services";

const KEY = "leftovr.measurementSystem";
const listeners = new Set<(value: MeasurementSystem) => void>();

export function useMeasurementSystem() {
  const [system, setSystem] = useState<MeasurementSystem>("metric");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY).then((value) => {
      if (active && (value === "metric" || value === "imperial")) setSystem(value);
    });
    const listener = (value: MeasurementSystem) => setSystem(value);
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback(async (value: MeasurementSystem) => {
    await AsyncStorage.setItem(KEY, value);
    for (const l of listeners) l(value);
  }, []);

  return { system, setMeasurementSystem: update };
}
