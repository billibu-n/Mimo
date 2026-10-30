/* hijos.js — catálogo de los modos que viven dentro de Tiempo.
   El padre les da el slot; cada uno puede faltar sin romper el cronómetro. */
(function () {
  "use strict";
  window.MimoTiempoHijos = [
    { id: "crono", nombre: ["Cronómetro", "Stopwatch", "秒表"], desc: ["Cuenta hacia arriba.", "Counts up.", "向上计时。"] },
    { id: "temporizador", nombre: ["Temporizador", "Timer", "计时器"], desc: ["Cuenta atrás.", "Counts down.", "倒计时。"] },
    { id: "pomodoro", nombre: ["Pomodoro", "Pomodoro", "番茄钟"], desc: ["Trabajo y pausas.", "Work and breaks.", "工作与休息。"] },
    { id: "alarmas", nombre: ["Alarmas", "Alarms", "闹钟"], desc: ["Avisos a una hora.", "Alerts at a time.", "定时提醒。"] }
  ];
})();
