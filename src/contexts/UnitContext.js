import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@unit_prefs';

const UnitContext = createContext({
  tempUnit: 'C',
  windUnit: 'ms',
  setTempUnit: () => {},
  setWindUnit: () => {},
  formatTemp: (val) => `${Math.round(val)}°`,
  formatWind: (val) => `${val}m/s`,
});

export const UnitProvider = ({ children }) => {
  const [tempUnit, setTempUnitState] = useState('C');
  const [windUnit, setWindUnitState] = useState('ms');

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(raw => {
      if (!raw) return;
      try {
        const prefs = JSON.parse(raw);
        if (prefs.tempUnit) setTempUnitState(prefs.tempUnit);
        if (prefs.windUnit) setWindUnitState(prefs.windUnit);
      } catch {}
    });
  }, []);

  const persist = (newTempUnit, newWindUnit) => {
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ tempUnit: newTempUnit, windUnit: newWindUnit }));
  };

  const setTempUnit = (unit) => {
    setTempUnitState(unit);
    persist(unit, windUnit);
  };

  const setWindUnit = (unit) => {
    setWindUnitState(unit);
    persist(tempUnit, unit);
  };

  // Accepts number (°C) or string like "25°" / "25"
  const formatTemp = (val) => {
    let celsius;
    if (typeof val === 'number') celsius = val;
    else celsius = parseFloat(String(val).replace('°', ''));
    if (val === '--' || val === '--°' || isNaN(celsius)) return '--°';
    if (tempUnit === 'F') return `${Math.round(celsius * 9 / 5 + 32)}°F`;
    return `${Math.round(celsius)}°`;
  };

  // Accepts number (m/s) or string like "3.5m/s"
  const formatWind = (val) => {
    let ms;
    if (typeof val === 'number') ms = val;
    else ms = parseFloat(String(val));
    if (val === '--' || isNaN(ms)) return '--';
    if (windUnit === 'kmh') return `${(ms * 3.6).toFixed(1)}km/h`;
    if (windUnit === 'mph') return `${(ms * 2.237).toFixed(1)}mph`;
    return `${ms.toFixed(1)}m/s`;
  };

  // Returns just the numeric value for charts (always in °C)
  const parseTempNum = (val) => {
    if (typeof val === 'number') return val;
    const n = parseFloat(String(val).replace('°', ''));
    return isNaN(n) ? 0 : n;
  };

  return (
    <UnitContext.Provider value={{ tempUnit, windUnit, setTempUnit, setWindUnit, formatTemp, formatWind, parseTempNum }}>
      {children}
    </UnitContext.Provider>
  );
};

export const useUnits = () => useContext(UnitContext);
