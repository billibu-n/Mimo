/* shell.js — armazón M11/M12: pestañas base + bloques, panel de 4 y estado local.
   Sin motores: los datos son del usuario y viven en localStorage['mimo.shell.v1']. */
(function () {
  "use strict";

  var CLAVE = "mimo.shell.v1";
  var RESET = /[?&]reset=1\b/.test(location.search);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var I18N = {
    es: {
      "nav.calendario": "Calendario", "nav.tareas": "Tareas", "nav.notas": "Notas", "nav.tiempo": "Tiempo",
      "nav.malla": "Malla", "nav.calificaciones": "Calificaciones", "nav.estudio": "Estudio", "nav.ajustes": "Ajustes",
      "panel.contexto": "Contexto", "panel.detalle": "Detalle", "panel.notas": "Notas", "panel.bloques": "Bloques",
      "sub.calendario": "Todo lo que tiene fecha, en un solo sitio.",
      "sub.tareas": "Proyectos y tareas sobre tareas; el progreso se calcula solo.",
      "sub.notas": "El material que no es tarea: texto, enlaces y contexto. Clic derecho en una nota para acciones.",
      "sub.tiempo": "Los modos viven arriba; se agregan y se quitan como bloques.",
      "sub.malla": "La carrera se dibuja sola por niveles. Elige un ramo para ver qué necesita y qué desbloquea.",
      "sub.calificaciones": "Categorías, componentes, examen y eximición. La nota se calcula sola.",
      "sub.estudio": "Horas por ramo, meta semanal y avance. Lo registrado en Tiempo entra aquí.",
      "sub.ajustes": "Apariencia, idioma, datos y extensiones, en ese orden.",
      "grupo.aplicacion": "Aplicación", "grupo.aplicacion.sub": "Lo que aplica a toda la app.",
      "grupo.datos": "Datos", "grupo.datos.sub": "Lo que entra, sale y se guarda.",
      "grupo.extensiones": "Extensiones", "grupo.extensiones.sub": "Bloques, laboratorio y versión.",
      "aj.apariencia": "Apariencia", "aj.apariencia.sub": "Diez temas. El botón sol/luna salta entre la pareja claro/oscuro.",
      "aj.idioma": "Idioma", "aj.idioma.sub": "Motor i18n es/en/zh. Navegación, encabezados y bandera cambian en caliente.",
      "aj.notificaciones": "Notificaciones", "aj.notificaciones.sub": "Recordatorios y sonido del sistema.",
      "aj.general": "General", "aj.general.sub": "Inicio de semana y formato de hora.",
      "aj.navegacion": "Navegación", "aj.navegacion.sub": "Dónde viven las secciones.",
      "aj.paneles": "Paneles", "aj.paneles.sub": "Ancho y visibilidad del panel derecho.",
      "aj.periodos": "Periodos", "aj.periodos.sub": "Arcos con clases, receso y exámenes.",
      "aj.respaldo": "Respaldo", "aj.sync": "Sincronización", "aj.kits": "Kits y bloques",
      "aj.laboratorio": "Laboratorio", "aj.laboratorio.sub": "La vista dividida ocupa la mitad de la ventana.",
      "aj.temaClaro": "Tema claro", "aj.temaOscuro": "Tema oscuro", "aj.idioma.etiqueta": "Idioma",
      "aj.avisos": "Avisos activos", "aj.semana": "La semana empieza en", "aj.lunes": "Lunes", "aj.domingo": "Domingo",
      "aj.hora": "Formato de hora", "aj.barra": "Barra de secciones", "aj.arriba": "Arriba", "aj.izquierda": "Izquierda",
      "aj.ancho": "Ancho", "aj.abierto": "Abierto al iniciar", "aj.abrirPanel": "Abrir panel",
      "aj.acerca": "Acerca de",
      "top.buscar": "Buscar", "cal.semana": "Sem",
      "top.add": "Agregar un bloque", "top.nuevo": "Definir un periodo", "top.activo": "Periodo activo",
      "top.version": "Versión", "top.sync": "Guardado en este equipo", "top.tema": "Cambiar entre claro y oscuro",
      "top.split": "Vista dividida", "top.panel": "Panel de herramientas", "top.ajustes": "Ajustes",
      "panel.titulo": "Panel", "panel.herramientas": "Herramientas del panel", "panel.cerrar": "Cerrar panel",
      "panel.ahora": "Ahora", "panel.sinEventos": "Sin eventos este mes.",
      "panel.sinContexto": "Sin contexto", "panel.estaSeccion": "Esta sección no declara contexto.",
      "periodo.sin": "Sin periodo", "pie.guardado": "local · guardado", "pie.ayuda": "Ayuda", "pie.panel": "Panel",
      "acc.guardar": "Guardar", "acc.cancelar": "Cancelar", "acc.editar": "Editar", "acc.borrar": "Borrar", "acc.cerrar": "Cerrar",
      "cal.vista.mes": "Mes", "cal.vista.semana": "Semana", "cal.vista.agenda": "Agenda", "cal.hoy": "Hoy",
      "cal.nuevo": "+ Nuevo evento", "cal.contextos": "Contextos",
      "cal.sinContextos": "Sin contextos todavía. Crea uno al primer evento o tarea.",
      "cal.calendarios": "Calendarios", "cal.local": "Local · este equipo",
      "cal.anterior": "Anterior", "cal.siguiente": "Siguiente",
      "cal.kpi.eventos": "eventos este mes", "cal.kpi.tareas": "tareas con fecha",
      "cal.kpi.horas": "registradas", "cal.kpi.bloques": "bloques instalados",
      "cal.evento.titulo": "Título del evento", "cal.evento.fecha": "Fecha", "cal.evento.hora": "Hora",
      "cal.evento.contexto": "Contexto (opcional)", "cal.contexto": "Contexto",
      "cal.vacio": "Sin eventos. Todo lo que tenga fecha aparecerá aquí.",
      "cal.agenda": "Agenda", "cal.proximo": "próximo", "cal.pasado": "pasado",
      "cal.sinEventos": "Sin eventos todavía.", "cal.semanaDel": "Semana del",
      "cal.receso": "receso", "cal.examenes": "exámenes",
      "cal.tituloSemana": "Semana {n} de clases del periodo", "cal.tituloReceso": "Semana de receso",
      "cal.tituloExamenes": "Semana de exámenes", "cal.fueraPeriodo": "Fuera del periodo activo",
      "cal.clicTipo": "Clic para cambiar el tipo", "cal.evento": "evento", "cal.eventos": "eventos",
      "cal.vistaAria": "Vista del calendario", "cal.clicDerecho": "Clic derecho: acciones",
      "panel.evento": "Evento", "panel.fecha": "Fecha", "panel.hora": "Hora", "panel.contexto": "Contexto",
      "panel.notasEnlazadas": "Notas enlazadas", "panel.sinTitulo": "Sin título",
      "panel.proximoEvento": "El próximo evento aparece en la agenda.",
      "panel.detalleVacio": "Selecciona una tarea, una nota o un ramo. El detalle vive aquí, no en un modal que tapa la lista.",
      "panel.tarea": "Tarea", "panel.proyecto": "Proyecto", "panel.estado": "Estado",
      "panel.hecha": "hecha", "panel.abierta": "abierta", "panel.prioridad": "Prioridad",
      "panel.dentroDe": "Dentro de", "panel.progreso": "Progreso", "panel.subtareas": "Subtareas",
      "panel.sinSubtareas": "Sin subtareas.", "panel.nota": "Nota", "panel.notas": "Notas", "panel.abrir": "Abrir", "panel.reabrir": "Reabrir", "panel.marcarHecha": "Hecha",
      "panel.progresoTareas": "{hechas} de {total} tareas dentro"
    },
    en: {
      "nav.calendario": "Calendar", "nav.tareas": "Tasks", "nav.notas": "Notes", "nav.tiempo": "Time",
      "nav.malla": "Degree plan", "nav.calificaciones": "Grades", "nav.estudio": "Study", "nav.ajustes": "Settings",
      "panel.contexto": "Context", "panel.detalle": "Details", "panel.notas": "Notes", "panel.bloques": "Blocks",
      "sub.calendario": "Everything with a date, in one place.",
      "sub.tareas": "Projects and tasks on tasks; progress is calculated.",
      "sub.notas": "Material that is not a task: text, links and context. Right-click a note for actions.",
      "sub.tiempo": "Modes live above; add and remove them like blocks.",
      "sub.malla": "Your degree is drawn by levels. Pick a course to see what it needs and unlocks.",
      "sub.calificaciones": "Categories, components, exam and exemption. Your grade is calculated.",
      "sub.estudio": "Hours per course, weekly goal and progress. Time sessions land here.",
      "sub.ajustes": "Appearance, language, data and extensions, in that order.",
      "grupo.aplicacion": "Application", "grupo.aplicacion.sub": "What applies to the whole app.",
      "grupo.datos": "Data", "grupo.datos.sub": "What comes in, goes out and is saved.",
      "grupo.extensiones": "Extensions", "grupo.extensiones.sub": "Blocks, lab and version.",
      "aj.apariencia": "Appearance", "aj.apariencia.sub": "Ten themes. The sun/moon button jumps between the light/dark pair.",
      "aj.idioma": "Language", "aj.idioma.sub": "i18n engine es/en/zh. Navigation, headings and flag change live.",
      "aj.notificaciones": "Notifications", "aj.notificaciones.sub": "System reminders and sound.",
      "aj.general": "General", "aj.general.sub": "Week start and time format.",
      "aj.navegacion": "Navigation", "aj.navegacion.sub": "Where the sections live.",
      "aj.paneles": "Panels", "aj.paneles.sub": "Width and visibility of the right panel.",
      "aj.periodos": "Terms", "aj.periodos.sub": "Arcs with classes, breaks and exams.",
      "aj.respaldo": "Backup", "aj.sync": "Sync", "aj.kits": "Kits and blocks",
      "aj.laboratorio": "Lab", "aj.laboratorio.sub": "Split view takes half the window.",
      "aj.temaClaro": "Light theme", "aj.temaOscuro": "Dark theme", "aj.idioma.etiqueta": "Language",
      "aj.avisos": "Notifications", "aj.semana": "Week starts on", "aj.lunes": "Monday", "aj.domingo": "Sunday",
      "aj.hora": "Time format", "aj.barra": "Section bar", "aj.arriba": "Top", "aj.izquierda": "Left",
      "aj.ancho": "Width", "aj.abierto": "Open on start", "aj.abrirPanel": "Open panel",
      "aj.acerca": "About",
      "top.buscar": "Search", "cal.semana": "Wk",
      "top.add": "Add a block", "top.nuevo": "Define a term", "top.activo": "Active term",
      "top.version": "Version", "top.sync": "Saved on this device", "top.tema": "Toggle light and dark",
      "top.split": "Split view", "top.panel": "Tools panel", "top.ajustes": "Settings",
      "panel.titulo": "Panel", "panel.herramientas": "Panel tools", "panel.cerrar": "Close panel",
      "panel.ahora": "Now", "panel.sinEventos": "No events this month.",
      "panel.sinContexto": "No context", "panel.estaSeccion": "This section declares no context.",
      "periodo.sin": "No term", "pie.guardado": "local · saved", "pie.ayuda": "Help", "pie.panel": "Panel",
      "acc.guardar": "Save", "acc.cancelar": "Cancel", "acc.editar": "Edit", "acc.borrar": "Delete", "acc.cerrar": "Close",
      "cal.vista.mes": "Month", "cal.vista.semana": "Week", "cal.vista.agenda": "Agenda", "cal.hoy": "Today",
      "cal.nuevo": "+ New event", "cal.contextos": "Contexts",
      "cal.sinContextos": "No contexts yet. Create one on your first event or task.",
      "cal.calendarios": "Calendars", "cal.local": "Local · this device",
      "cal.anterior": "Previous", "cal.siguiente": "Next",
      "cal.kpi.eventos": "events this month", "cal.kpi.tareas": "tasks with a date",
      "cal.kpi.horas": "logged", "cal.kpi.bloques": "installed blocks",
      "cal.evento.titulo": "Event title", "cal.evento.fecha": "Date", "cal.evento.hora": "Time",
      "cal.evento.contexto": "Context (optional)", "cal.contexto": "Context",
      "cal.vacio": "No events. Everything with a date will appear here.",
      "cal.agenda": "Agenda", "cal.proximo": "upcoming", "cal.pasado": "past",
      "cal.sinEventos": "No events yet.", "cal.semanaDel": "Week of",
      "cal.receso": "break", "cal.examenes": "exams",
      "cal.tituloSemana": "Week {n} of classes in the term", "cal.tituloReceso": "Break week",
      "cal.tituloExamenes": "Exam week", "cal.fueraPeriodo": "Outside the active term",
      "cal.clicTipo": "Click to change the type", "cal.evento": "event", "cal.eventos": "events",
      "cal.vistaAria": "Calendar view", "cal.clicDerecho": "Right-click: actions",
      "panel.evento": "Event", "panel.fecha": "Date", "panel.hora": "Time", "panel.contexto": "Context",
      "panel.notasEnlazadas": "Linked notes", "panel.sinTitulo": "Untitled",
      "panel.proximoEvento": "The next event appears in the agenda.",
      "panel.detalleVacio": "Select a task, a note or a course. Details live here, not in a modal over the list.",
      "panel.tarea": "Task", "panel.proyecto": "Project", "panel.estado": "Status",
      "panel.hecha": "done", "panel.abierta": "open", "panel.prioridad": "Priority",
      "panel.dentroDe": "Inside", "panel.progreso": "Progress", "panel.subtareas": "Subtasks",
      "panel.sinSubtareas": "No subtasks.", "panel.nota": "Note", "panel.notas": "Notes", "panel.abrir": "Open", "panel.reabrir": "Reopen", "panel.marcarHecha": "Done",
      "panel.progresoTareas": "{hechas} of {total} tasks inside"
    },
    zh: {
      "nav.calendario": "日历", "nav.tareas": "任务", "nav.notas": "笔记", "nav.tiempo": "时间",
      "nav.malla": "课程规划", "nav.calificaciones": "成绩", "nav.estudio": "学习", "nav.ajustes": "设置",
      "panel.contexto": "上下文", "panel.detalle": "详情", "panel.notas": "笔记", "panel.bloques": "模块",
      "sub.calendario": "所有带日期的事情，都集中在这里。",
      "sub.tareas": "任务可以层层拆分，进度自动计算。",
      "sub.notas": "不是任务的材料：文字、链接和上下文。右键点击笔记可操作。",
      "sub.tiempo": "模式在上方；像模块一样添加或移除。",
      "sub.malla": "课程按层级自动绘制。选择一门课，查看先修要求和可解锁内容。",
      "sub.calificaciones": "分类、评分项、考试和免考。成绩自动计算。",
      "sub.estudio": "按课程统计小时数、每周目标和进度。时间记录会自动进入这里。",
      "sub.ajustes": "外观、语言、数据和扩展，按此顺序。",
      "grupo.aplicacion": "应用", "grupo.aplicacion.sub": "适用于整个应用的设置。",
      "grupo.datos": "数据", "grupo.datos.sub": "数据的导入、导出和保存。",
      "grupo.extensiones": "扩展", "grupo.extensiones.sub": "模块、实验室和版本。",
      "aj.apariencia": "外观", "aj.apariencia.sub": "十种主题。太阳/月亮按钮在浅色/深色配对间切换。",
      "aj.idioma": "语言", "aj.idioma.sub": "支持西班牙语、英语和简体中文。导航、标题和旗帜即时切换。",
      "aj.notificaciones": "通知", "aj.notificaciones.sub": "系统提醒和声音。",
      "aj.general": "常规", "aj.general.sub": "一周起始和小时格式。",
      "aj.navegacion": "导航", "aj.navegacion.sub": "各分区的位置。",
      "aj.paneles": "面板", "aj.paneles.sub": "右侧面板的宽度和可见性。",
      "aj.periodos": "学期", "aj.periodos.sub": "课程、假期和考试周。",
      "aj.respaldo": "备份", "aj.sync": "同步", "aj.kits": "套件与模块",
      "aj.laboratorio": "实验室", "aj.laboratorio.sub": "分屏占窗口的一半。",
      "aj.temaClaro": "浅色主题", "aj.temaOscuro": "深色主题", "aj.idioma.etiqueta": "语言",
      "aj.avisos": "启用提醒", "aj.semana": "一周开始于", "aj.lunes": "星期一", "aj.domingo": "星期日",
      "aj.hora": "时间格式", "aj.barra": "分区栏位置", "aj.arriba": "顶部", "aj.izquierda": "左侧",
      "aj.ancho": "宽度", "aj.abierto": "启动时打开", "aj.abrirPanel": "打开面板",
      "aj.acerca": "关于",
      "top.buscar": "搜索", "cal.semana": "周",
      "top.add": "添加模块", "top.nuevo": "定义学期", "top.activo": "当前学期",
      "top.version": "版本", "top.sync": "已保存到本设备", "top.tema": "切换浅色/深色",
      "top.split": "分屏视图", "top.panel": "工具面板", "top.ajustes": "设置",
      "panel.titulo": "面板", "panel.herramientas": "面板工具", "panel.cerrar": "关闭面板",
      "panel.ahora": "现在", "panel.sinEventos": "本月没有事件。",
      "panel.sinContexto": "无上下文", "panel.estaSeccion": "此分区没有上下文。",
      "periodo.sin": "无学期", "pie.guardado": "本地 · 已保存", "pie.ayuda": "帮助", "pie.panel": "面板",
      "acc.guardar": "保存", "acc.cancelar": "取消", "acc.editar": "编辑", "acc.borrar": "删除", "acc.cerrar": "关闭",
      "cal.vista.mes": "月", "cal.vista.semana": "周", "cal.vista.agenda": "议程", "cal.hoy": "今天",
      "cal.nuevo": "+ 新建事件", "cal.contextos": "情境",
      "cal.sinContextos": "还没有情境。在第一个事件或任务中创建一个。",
      "cal.calendarios": "日历", "cal.local": "本地 · 本设备",
      "cal.anterior": "上一个", "cal.siguiente": "下一个",
      "cal.kpi.eventos": "本月事件", "cal.kpi.tareas": "有日期的任务",
      "cal.kpi.horas": "已记录", "cal.kpi.bloques": "已安装模块",
      "cal.evento.titulo": "事件标题", "cal.evento.fecha": "日期", "cal.evento.hora": "时间",
      "cal.evento.contexto": "情境（可选）", "cal.contexto": "情境",
      "cal.vacio": "没有事件。所有带日期的事情都会出现在这里。",
      "cal.agenda": "议程", "cal.proximo": "即将到来", "cal.pasado": "已过去",
      "cal.sinEventos": "还没有事件。", "cal.semanaDel": "周：",
      "cal.receso": "假期", "cal.examenes": "考试",
      "cal.tituloSemana": "学期第 {n} 教学周", "cal.tituloReceso": "假期周",
      "cal.tituloExamenes": "考试周", "cal.fueraPeriodo": "当前学期之外",
      "cal.clicTipo": "点击更改类型", "cal.evento": "事件", "cal.eventos": "事件",
      "cal.vistaAria": "日历视图", "cal.clicDerecho": "右键：操作",
      "panel.evento": "事件", "panel.fecha": "日期", "panel.hora": "时间", "panel.contexto": "情境",
      "panel.notasEnlazadas": "已链接笔记", "panel.sinTitulo": "无标题",
      "panel.proximoEvento": "下一个事件会出现在议程中。",
      "panel.detalleVacio": "选择任务、笔记或课程。详情显示在这里，不会用弹窗遮住列表。",
      "panel.tarea": "任务", "panel.proyecto": "项目", "panel.estado": "状态",
      "panel.hecha": "已完成", "panel.abierta": "未完成", "panel.prioridad": "优先级",
      "panel.dentroDe": "所属", "panel.progreso": "进度", "panel.subtareas": "子任务",
      "panel.sinSubtareas": "没有子任务。", "panel.nota": "笔记", "panel.notas": "笔记", "panel.abrir": "打开", "panel.reabrir": "重新打开", "panel.marcarHecha": "完成",
      "panel.progresoTareas": "内部任务 {hechas}/{total}"
    }
  };
  function idioma() { return (estado && estado.prefs && estado.prefs.idioma) || "es"; }
  function t(k) {
    var d = I18N[idioma()] || I18N.es;
    return d[k] || I18N.es[k] || k;
  }
  function tf(k, vars) {
    var s = t(k);
    Object.keys(vars || {}).forEach(function (x) { s = s.replace("{" + x + "}", vars[x]); });
    return s;
  }
  function tr(k) { return t(k); }
  function L(es, en, zh) {
    var i = idioma();
    return i === "zh" ? zh : i === "en" ? en : es;
  }
  function localeActual() { return idioma() === "zh" ? "zh-CN" : idioma() === "en" ? "en-US" : "es-CL"; }
  var DIAS_SEMANA = {
    es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  };
  function diasSemana() {
    var d = (DIAS_SEMANA[idioma()] || DIAS_SEMANA.es).slice();
    if ((estado.prefs || {}).inicioSemana !== "domingo") d.push(d.shift());
    return d;
  }
  var TEMAS = [
    ["clasico", "Clásico", "claro"], ["deepsea", "DeepSea", "oscuro"], ["medianoche", "Medianoche", "oscuro"],
    ["negro", "Negro", "oscuro"], ["vino", "Vino", "oscuro"], ["bosque", "Bosque", "claro"],
    ["sepia", "Sepia", "claro"], ["pinky", "Pinky", "claro"],
    ["alto-contraste-claro", "Alto contraste claro", "claro"],
    ["alto-contraste", "Alto contraste oscuro", "oscuro"]
  ];
  var BLOQUES = {
    tiempo: { nombre: "Tiempo", tipo: "seccion", icono: "i-tiempo", desc: "Cronómetro, temporizador, pomodoro y alarmas." },
    malla: { nombre: "Malla", tipo: "seccion", icono: "i-malla", desc: "Cursos, niveles y prerrequisitos." },
    calificaciones: { nombre: "Calificaciones", tipo: "seccion", icono: "i-libro", desc: "Categorías, examen y eximición." },
    estudio: { nombre: "Estudio", tipo: "seccion", icono: "i-tiempo", desc: "Horas por ramo y metas." },
    evaluaciones: { nombre: "Evaluaciones", tipo: "aporte", icono: "i-cal", desc: "Aporta evaluaciones al calendario." },
    academics: { nombre: "Academics", tipo: "pack", icono: "i-libro", desc: "Kit: Malla, Calificaciones, Estudio y Evaluaciones.", instala: ["malla", "calificaciones", "estudio", "evaluaciones"] }
  };
  var BASE = ["calendario", "tareas", "notas", "ajustes"];
  var ORDEN = ["tiempo", "malla", "calificaciones", "estudio"];
  var HIJOS = [["crono", "Cronómetro"], ["temporizador", "Temporizador"], ["pomodoro", "Pomodoro"], ["alarmas", "Alarmas"]];

  function porDefecto() {
    return {
      tema: "clasico", instalados: [], kits: {}, panel: {}, tareas: [], notas: [], eventos: [], cursos: [], califs: {},
      periodos: [], periodoActivo: null, sesiones: [], tiempoVinculo: "", tiempoRamo: "",
      tiempoModo: "crono", tempMin: 25, pomo: { trabajo: 25, corto: 5, largo: 15, cada: 4, fase: "trabajo", trabajos: 0 },
      alarmas: [], estudio: { metaSemanal: 10, metasRamo: {}, metasSemana: {} }, splitSeccion: "tareas",
      prefs: { inicioSemana: "lunes", hora: "24", panelAncho: "320", navPos: "arriba", idioma: "es", notificaciones: true, panelAbierto: true,
        temaClaro: "clasico", temaOscuro: "deepsea", ordenTabs: [] },
      notaSel: null, tareaSel: null, eventoSel: null, ramoSel: null, califSel: null, tiempoHijos: HIJOS.map(function (x) { return x[0]; })
    };
  }
  function leer() {
    var d = porDefecto();
    if (RESET) { try { localStorage.removeItem(CLAVE); } catch (e) {} return d; }
    try {
      var bruto = localStorage.getItem(CLAVE);
      if (bruto) {
        var x = JSON.parse(bruto);
        if (x && typeof x === "object") {
          Object.keys(d).forEach(function (k) { if (x[k] !== undefined) d[k] = x[k]; });
          if (!Array.isArray(d.instalados)) d.instalados = [];
          if (!Array.isArray(d.tareas)) d.tareas = [];
          if (!Array.isArray(d.notas)) d.notas = [];
          if (!Array.isArray(d.cursos)) d.cursos = [];
          if (!d.califs || typeof d.califs !== "object") d.califs = {};
          if (!d.pomo || typeof d.pomo !== "object") d.pomo = { trabajo: 25, corto: 5, largo: 15, cada: 4, fase: "trabajo", trabajos: 0 };
          if (!Array.isArray(d.alarmas)) d.alarmas = [];
          if (!d.estudio || typeof d.estudio !== "object") d.estudio = { metaSemanal: 10, metasRamo: {}, metasSemana: {} };
          if (!d.estudio.metasRamo || typeof d.estudio.metasRamo !== "object") d.estudio.metasRamo = {};
          if (!d.estudio.metasSemana || typeof d.estudio.metasSemana !== "object") d.estudio.metasSemana = {};
          if (!d.prefs || typeof d.prefs !== "object") d.prefs = {};
          if (!d.prefs.temaClaro) d.prefs.temaClaro = "clasico";
          if (!d.prefs.temaOscuro) d.prefs.temaOscuro = "deepsea";
          if (!Array.isArray(d.tiempoHijos)) d.tiempoHijos = HIJOS.map(function (y) { return y[0]; });
          if (!d.kits || typeof d.kits !== "object") d.kits = {};
          if (!d.panel || typeof d.panel !== "object") d.panel = {};
        }
      }
    } catch (e) {}
    return d;
  }
  var estado = leer();
  var pantalla = "calendario";
  var notaBusqueda = "";
  var notaModo = "editar";
  var vistaTareas = estado.vistaTareas || "hoy";
  var vistaCalendario = estado.vistaCalendario || "mes";
  var calCursor = new Date();
  var formEventoId = null;
  var formPeriodoId = null;
  var mapaPeriodo = null;
  var formAlarmaId = null;
  var tiempoSeg = 0, tiempoInt = null, tempSeg = 0, tempInicial = 0, pomoSeg = 0, pomoInicial = 0;
  var splitOn = false;
  var tabArrastrada = null;
  var splitNavHasta = 0;

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {}
    if (window.MimoSync && window.MimoSync.alCambiar) {
      try { window.MimoSync.alCambiar(); } catch (e) {}
    }
  }
  function aviso(texto, deshacer) {
    var t = $("#toast"); t.innerHTML = "";
    var span = document.createElement("span"); span.textContent = texto; t.appendChild(span);
    if (typeof deshacer === "function") {
      var b = document.createElement("button");
      b.type = "button"; b.className = "toast__accion"; b.textContent = L("Deshacer", "Undo", "撤销");
      b.addEventListener("click", function () {
        t.classList.remove("on"); clearTimeout(t._t);
        deshacer();
      });
      t.appendChild(b);
    }
    t.classList.add("on");
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove("on"); }, typeof deshacer === "function" ? 6500 : 2600);
  }
  function resumenEstado(s) {
    s = s || estado;
    return {
      tareas: (s.tareas || []).length,
      notas: (s.notas || []).length,
      eventos: (s.eventos || []).length,
      ramos: (s.cursos || []).length,
      sesiones: (s.sesiones || []).length,
      periodos: (s.periodos || []).length
    };
  }
  function estadoTieneDatos(s) {
    var r = resumenEstado(s);
    return !!(r.tareas || r.notas || r.eventos || r.ramos || r.sesiones || r.periodos);
  }
  function reemplazarEstado(nuevo) {
    nuevo = nuevo && typeof nuevo === "object" ? nuevo : {};
    estado = Object.assign(porDefecto(), nuevo);
    estado.prefs = Object.assign(porDefecto().prefs, nuevo.prefs || {});
    estado.estudio = Object.assign({ metaSemanal: 10, metasRamo: {}, metasSemana: {} }, nuevo.estudio || {});
    normalizarEventos(); normalizarTareas(); normalizarNotas(); normalizarCursos(); normalizarCalifs(); normalizarEstudio();
    guardar(); aplicarTema(estado.tema || "clasico"); aplicarPrefs(); aplicarIdioma();
    pintarTabs(); pintarCalendario(); pintarTareas(); pintarNotas(); pintarMalla(); pintarCalificaciones(); pintarEstudio(); pintarTiempo(); pintarPeriodo(); pintarSplit(); pintarPanel();
    return estado;
  }

  /* ---- acciones: menú de clic derecho + borrado en toda la app ---- */
  var menuAcciones = {};

  function notaPorId(id) {
    return estado.notas.filter(function (n) { return n.id === id; })[0] || null;
  }
  function crearNota() {
    var n = {
      id: "n" + Date.now(), titulo: "Sin título", cuerpo: "", contexto: "", etiquetas: [],
      enlaces: [], fijada: false, actualizado: selloLocal()
    };
    estado.notas.unshift(n);
    estado.notaSel = n.id;
    guardar(); pintarNotas(); pintarPanel();
    $("#nota-titulo").focus(); $("#nota-titulo").select();
  }
  function crearTarea(tipo) {
    abrirFormulario(null);
    if (tipo === "proyecto") $("#tarea-tipo").value = "proyecto";
  }
  function abrirNota(id) {
    if (!notaPorId(id)) return;
    estado.notaSel = id;
    estado.panel.notas = "detalle";
    guardar();
    if (pantalla !== "notas") ir("notas"); else { pintarNotas(); pintarPanel(); }
    if (window.innerWidth <= 1255) abrirPanel();
  }
  function abrirTarea(id) {
    if (!tareaPorId(id)) return;
    estado.tareaSel = id;
    estado.panel.tareas = "detalle";
    guardar();
    if (pantalla !== "tareas") ir("tareas"); else { pintarTareas(); pintarPanel(); }
    if (window.innerWidth <= 1255) abrirPanel();
  }
  function abrirEventoDetalle(id) {
    if (!eventoPorId(id)) return;
    estado.eventoSel = id;
    estado.panel.calendario = "detalle";
    guardar();
    if (pantalla !== "calendario") ir("calendario"); else { pintarCalendario(); pintarPanel(); }
    if (window.innerWidth <= 1255) abrirPanel();
  }
  function alternarTarea(id) {
    var x = tareaPorId(id); if (!x) return;
    x.hecha = !x.hecha; x.estado = x.hecha ? "hecha" : "pendiente";
    guardar(); pintarTareas(); pintarPanel();
  }
  function crearEventoEn(fecha) {
    abrirEvento(null);
    if (fecha) $("#evento-fecha").value = fecha;
    $("#evento-titulo").focus();
  }
  function borrarNota(id) {
    var n = notaPorId(id); if (!n) return;
    var tituloN = !n.titulo || n.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : n.titulo;
    if (!window.confirm(L("¿Borrar la nota \"" + tituloN + "\"?", "Delete the note \"" + tituloN + "\"?", "删除笔记“" + tituloN + "”？"))) return;
    var copia = Object.assign({}, n), pos = estado.notas.map(function (x) { return x.id; }).indexOf(id);
    estado.notas = estado.notas.filter(function (x) { return x.id !== id; });
    if (estado.notaSel === id) estado.notaSel = estado.notas.length ? estado.notas[0].id : null;
    guardar(); pintarNotas(); pintarPanel();
    aviso(L("Nota borrada.", "Note deleted.", "笔记已删除。"), function () {
      estado.notas.splice(Math.max(0, Math.min(pos, estado.notas.length)), 0, copia);
      estado.notaSel = copia.id; guardar(); pintarNotas(); pintarPanel(); aviso(L("Nota restaurada.", "Note restored.", "笔记已恢复。"));
    });
  }
  function borrarPeriodo(id) {
    var p = (estado.periodos || []).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!window.confirm(L("¿Borrar el periodo \"" + p.nombre + "\" y sus semanas?", "Delete the term \"" + p.nombre + "\" and its weeks?", "删除学期“" + p.nombre + "”及其周次？"))) return;
    var copia = Object.assign({}, p), activo = estado.periodoActivo;
    estado.periodos = estado.periodos.filter(function (x) { return x.id !== id; });
    if (estado.periodoActivo === id) estado.periodoActivo = estado.periodos.length ? estado.periodos[0].id : null;
    guardar(); pintarPeriodo();
    aviso(L("Periodo borrado. Sus eventos no se tocan.", "Term deleted. Its events are untouched.", "学期已删除。事件不受影响。"), function () {
      estado.periodos.push(copia); estado.periodoActivo = activo; guardar(); pintarPeriodo(); aviso(L("Periodo restaurado.", "Term restored.", "学期已恢复。"));
    });
  }
  function borrarSesion(ref) {
    var lista = estado.sesiones || [];
    var idx = typeof ref === "number" ? ref : lista.map(function (s) { return s.id; }).indexOf(String(ref));
    var s = lista[idx]; if (!s) return;
    if (!window.confirm(L("¿Borrar la sesión de " + fmtDuracion(s.minutos) + " del " + s.fecha + "?", "Delete the " + fmtDuracion(s.minutos) + " session on " + s.fecha + "?", "删除 " + s.fecha + " 的 " + fmtDuracion(s.minutos) + " 会话？"))) return;
    var copia = Object.assign({}, s);
    lista.splice(idx, 1);
    guardar(); pintarTiempo(); pintarEstudio();
    aviso(L("Sesión borrada.", "Session deleted.", "会话已删除。"), function () {
      lista.splice(Math.max(0, Math.min(idx, lista.length)), 0, copia);
      guardar(); pintarTiempo(); pintarEstudio(); aviso(L("Sesión restaurada.", "Session restored.", "会话已恢复。"));
    });
  }
  function duracionInput(min) {
    var total = Math.max(0, Math.round((Number(min) || 0) * 60));
    var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return [h, m, s].map(function (x) { return String(x).padStart(2, "0"); }).join(":");
  }
  function abrirSesionModal(id) {
    var s = (estado.sesiones || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    $("#sesion-id").value = s.id;
    $("#sesion-fecha").value = s.fecha || hoyISO();
    $("#sesion-duracion").value = duracionInput(s.minutos);
    $("#sesion-hora").value = s.hora || "";
    var ops = ['<option value="">' + esc(L("Sin ramo", "No course", "无课程")) + '</option>'];
    (estado.cursos || []).forEach(function (c) { ops.push('<option value="' + esc(c.codigo) + '">' + esc(c.codigo) + " — " + esc(c.nombre) + "</option>"); });
    $("#sesion-ramo").innerHTML = ops.join("");
    $("#sesion-ramo").value = s.ramo || "";
    $("#modal-sesion").classList.add("on");
    $("#sesion-duracion").focus();
    $("#sesion-duracion").select();
  }
  function cerrarSesionModal() { $("#modal-sesion").classList.remove("on"); }
  function guardarSesionModal(e) {
    if (e) e.preventDefault();
    var id = $("#sesion-id").value;
    var s = (estado.sesiones || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var minutos = Math.min(1440, parseDuracion($("#sesion-duracion").value));
    if (!minutos) { aviso(L("La duración no puede quedar en cero.", "Duration cannot be zero.", "时长不能为零。")); return; }
    s.fecha = $("#sesion-fecha").value || s.fecha || hoyISO();
    s.minutos = Math.round(minutos * 100) / 100;
    s.ramo = $("#sesion-ramo").value || "";
    s.hora = $("#sesion-hora").value || "";
    guardar(); cerrarSesionModal(); pintarTiempo(); pintarEstudio();
    aviso(L("Sesión corregida: ", "Session updated: ", "会话已修正：") + fmtDuracion(s.minutos) + ".");
  }
  function menuTitulo(tipo, texto) { return tipo + " · " + (texto || L("Sin título", "Untitled", "无标题")); }
  function menuDeContexto(el) {
    var rEl = el.closest("[data-ramo]");
    if (rEl) {
      var r = ramoPorCodigo(rEl.getAttribute("data-ramo"));
      if (!r) return null;
      return { titulo: menuTitulo(L("Ramo", "Course", "课程"), r.codigo + " — " + r.nombre), items: [
        { accion: "ramo-abrir", texto: L("Abrir ficha", "Open details", "打开详情"), run: function () {
          estado.ramoSel = r.codigo; estado.panel.malla = "detalle";
          guardar(); pintarMalla(); pintarPanel();
          if (window.innerWidth <= 1255) abrirPanel();
        } },
        { accion: "ramo-editar", texto: "Editar", run: function () { abrirFormularioRamo(r); } },
        { accion: "ramo-estado", texto: r.cerrado ? L("Reabrir", "Reopen", "重新打开") : L("Cerrar curso", "Close course", "关闭课程"), run: function () { alternarRamo(r.codigo); } },
        { sep: true },
        { accion: "ramo-borrar", texto: L("Borrar ramo", "Delete course", "删除课程"), peligro: true, run: function () { borrarRamo(r.codigo); } }
      ] };
    }

    var nEl = el.closest("[data-nota]");
    if (nEl) {
      var n = notaPorId(nEl.getAttribute("data-nota"));
      if (!n) return null;
      var ni = [
        { accion: "nota-abrir", texto: L("Abrir", "Open", "打开"), run: function () { abrirNota(n.id); } },
        { accion: "nota-fijar", texto: n.fijada ? L("Quitar fijada", "Unpin", "取消置顶") : L("Fijar", "Pin", "置顶"), run: function () {
          n.fijada = !n.fijada; guardar(); pintarNotas(); pintarPanel();
          aviso(n.fijada ? L("Nota fijada.", "Note pinned.", "笔记已置顶。") : L("Nota suelta.", "Note unpinned.", "笔记已取消置顶。"));
        } }
      ];
      if (n.enlaces && n.enlaces.length) {
        ni.push({ accion: "nota-desenlazar", texto: L("Quitar enlace", "Remove link", "移除链接"), run: function () {
          n.enlaces = []; guardar(); pintarNotas(); pintarPanel(); aviso(L("Enlace quitado.", "Link removed.", "链接已移除。"));
        } });
      }
      ni.push({ sep: true });
      ni.push({ accion: "nota-borrar", texto: L("Borrar nota", "Delete note", "删除笔记"), peligro: true, run: function () { borrarNota(n.id); } });
      return { titulo: menuTitulo(L("Nota", "Note", "笔记"), n.titulo), items: ni };
    }

    var eEl = el.closest("[data-evento]");
    if (eEl) {
      var ev = eventoPorId(eEl.getAttribute("data-evento"));
      if (!ev) return null;
      return { titulo: menuTitulo(L("Evento", "Event", "事件"), ev.titulo), items: [
        { accion: "evento-abrir", texto: L("Abrir detalle", "Open details", "打开详情"), run: function () { abrirEventoDetalle(ev.id); } },
        { accion: "evento-editar", texto: "Editar", run: function () { abrirEvento(ev); } },
        { sep: true },
        { accion: "evento-borrar", texto: L("Borrar evento", "Delete event", "删除事件"), peligro: true, run: function () { borrarEvento(ev.id); } }
      ] };
    }

    var tEl = el.closest("[data-tarea]");
    if (tEl) {
      var t = tareaPorId(tEl.getAttribute("data-tarea"));
      if (!t) return null;
      return { titulo: menuTitulo(t.tipo === "proyecto" ? L("Proyecto", "Project", "项目") : L("Tarea", "Task", "任务"), t.titulo), items: [
        { accion: "tarea-abrir", texto: L("Abrir detalle", "Open details", "打开详情"), run: function () { abrirTarea(t.id); } },
        { accion: "tarea-editar", texto: "Editar", run: function () { abrirFormulario(t); } },
        { accion: "tarea-estado", texto: t.hecha ? L("Reabrir", "Reopen", "重新打开") : L("Marcar hecha", "Mark done", "标为完成"), run: function () { alternarTarea(t.id); } },
        { accion: "tarea-sub", texto: L("Agregar subtarea", "Add subtask", "添加子任务"), run: function () { abrirFormulario(null, t.id); } },
        { sep: true },
        { accion: "tarea-borrar", texto: t.tipo === "proyecto" ? L("Borrar proyecto y sus tareas", "Delete project and its tasks", "删除项目及其任务") : L("Borrar tarea", "Delete task", "删除任务"), peligro: true,
          run: function () { borrarTarea(t.id); } }
      ] };
    }

    var pEl = el.closest("[data-periodo-item]");
    if (pEl) {
      var p = (estado.periodos || []).filter(function (x) { return x.id === pEl.getAttribute("data-periodo-item"); })[0];
      if (!p) return null;
      var pi = [];
      if (estado.periodoActivo !== p.id) {
        pi.push({ accion: "periodo-usar", texto: L("Usar este periodo", "Use this term", "使用此学期"), run: function () {
          estado.periodoActivo = p.id; guardar(); pintarPeriodo(); aviso(L("Periodo activo.", "Term set active.", "学期已设为当前。"));
        } });
      }
      if (pi.length) pi.push({ sep: true });
      pi.push({ accion: "periodo-editar", texto: L("Editar periodo", "Edit term", "编辑学期"), run: function () { abrirPeriodo(p.id); } });
      pi.push({ accion: "periodo-borrar", texto: L("Borrar periodo", "Delete term", "删除学期"), peligro: true, run: function () { borrarPeriodo(p.id); } });
      return { titulo: menuTitulo(L("Periodo", "Term", "学期"), p.nombre), items: pi };
    }

    var sEl = el.closest("[data-sesion]");
    if (sEl) {
      var sid = sEl.getAttribute("data-sesion");
      var s = (estado.sesiones || []).filter(function (x) { return x.id === sid; })[0] ||
              (estado.sesiones || [])[parseInt(sid, 10)];
      if (!s) return null;
      return { titulo: menuTitulo(L("Sesión", "Session", "会话"), fmtDuracion(s.minutos) + " · " + s.fecha), items: [
        { accion: "sesion-editar", texto: L("Editar sesión", "Edit session", "编辑会话"), run: function () { abrirSesionModal(s.id); } },
        { sep: true },
        { accion: "sesion-borrar", texto: L("Borrar sesión", "Delete session", "删除会话"), peligro: true, run: function () { borrarSesion(s.id); } }
      ] };
    }

    var dEl = el.closest("[data-cal-dia]");
    if (dEl) {
      var fecha = dEl.getAttribute("data-cal-dia");
      return { titulo: L("Día ", "Day ", "日期 ") + fecha.split("-").reverse().join("/"), items: [
        { accion: "dia-evento", texto: L("Nuevo evento este día", "New event this day", "当天新建事件"), run: function () { crearEventoEn(fecha); } }
      ] };
    }

    var zEl = el.closest("[data-ctx-zona]");
    if (zEl) {
      var zona = zEl.getAttribute("data-ctx-zona");
      if (zona === "notas") {
        return { titulo: L("Notas", "Notes", "笔记"), items: [{ accion: "zona-nota", texto: L("Nueva nota", "New note", "新建笔记"), run: crearNota }] };
      }
      if (zona === "tareas") {
        return { titulo: L("Tareas", "Tasks", "任务"), items: [
          { accion: "zona-tarea", texto: L("Nueva tarea", "New task", "新建任务"), run: function () { crearTarea("tarea"); } },
          { accion: "zona-proyecto", texto: L("Nuevo proyecto", "New project", "新建项目"), run: function () { crearTarea("proyecto"); } }
        ] };
      }
      if (zona === "calendario") {
        return { titulo: L("Calendario", "Calendar", "日历"), items: [
          { accion: "zona-evento", texto: L("Nuevo evento", "New event", "新建事件"), run: function () { crearEventoEn(""); } },
          { accion: "zona-periodo", texto: L("Nuevo periodo", "New term", "新建学期"), run: abrirPeriodo }
        ] };
      }
      if (zona === "malla") {
        return { titulo: L("Malla", "Degree plan", "课程规划"), items: [
          { accion: "zona-ramo", texto: L("Nuevo ramo", "New course", "新建课程"), run: function () { abrirFormularioRamo(null); } },
          { accion: "zona-importar-malla", texto: L("Importar malla", "Import plan", "导入规划"), run: function () { $("#archivo-malla").click(); } }
        ] };
      }
    }
    return null;
  }
  function abrirMenu(x, y, titulo, items) {
    var m = $("#menu-ctx"); if (!m || !items.length) return;
    menuAcciones = {};
    var html = titulo ? '<div class="menu-ctx__cab">' + esc(titulo) + "</div>" : "";
    items.forEach(function (it) {
      if (it.sep) { html += '<div class="menu-ctx__sep"></div>'; return; }
      menuAcciones[it.accion] = it.run;
      html += '<button type="button" role="menuitem" data-accion="' + esc(it.accion) + '"' +
        (it.peligro ? ' class="peligro"' : "") + ">" + esc(it.texto) + "</button>";
    });
    m.innerHTML = html;
    m.hidden = false;
    m.style.left = "0px"; m.style.top = "0px";
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + "px";
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + "px";
    var primero = m.querySelector("button");
    if (primero) primero.focus({ preventScroll: true });
  }
  function cerrarMenu() {
    var m = $("#menu-ctx");
    if (!m || m.hidden) return;
    m.hidden = true; m.innerHTML = ""; menuAcciones = {};
  }
  function menuPorTeclado(el) {
    var ctx = menuDeContexto(el); if (!ctx) return;
    var r = el.getBoundingClientRect();
    abrirMenu(r.left, r.bottom + 4, ctx.titulo, ctx.items);
  }
  function icono(id) { return '<svg class="icono" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function nombre(id) {
    if (["calendario", "tareas", "notas", "ajustes", "tiempo", "malla", "calificaciones", "estudio"].indexOf(id) !== -1) return t("nav." + id);
    return BLOQUES[id] ? BLOQUES[id].nombre : id;
  }
  function descripcionBloque(id) {
    var m = {
      tiempo: ["Cronómetro, temporizador, pomodoro y alarmas.", "Stopwatch, timer, pomodoro and alarms.", "秒表、计时器、番茄钟和闹钟。"],
      malla: ["Cursos, niveles y prerrequisitos.", "Courses, levels and prerequisites.", "课程、层级和先修要求。"],
      calificaciones: ["Categorías, examen y eximición.", "Categories, exam and exemption.", "分类、考试和免考。"],
      estudio: ["Horas por ramo y metas.", "Hours per course and goals.", "按课程小时和目标。"],
      evaluaciones: ["Aporta evaluaciones al calendario.", "Adds assessments to the calendar.", "将评估添加到日历。"],
      academics: ["Kit: Malla, Calificaciones, Estudio y Evaluaciones.", "Kit: plan, grades, study and assessments.", "套件：规划、成绩、学习和评估。"]
    }[id];
    return m ? L(m[0], m[1], m[2]) : (BLOQUES[id] ? BLOQUES[id].desc : L("Sección base.", "Base section.", "基础分区。"));
  }
  function iconoDe(id) {
    return { calendario: "i-cal", tareas: "i-tareas", notas: "i-notas", ajustes: "i-ajustes" }[id] ||
      (BLOQUES[id] ? BLOQUES[id].icono : "i-plus");
  }
  function instalado(id) { return estado.instalados.indexOf(id) !== -1; }
  function secciones() {
    var out = BASE.slice(0, 3);
    ORDEN.forEach(function (id) { if (instalado(id)) out.push(id); });
    out.push("ajustes");
    var orden = (estado.prefs && Array.isArray(estado.prefs.ordenTabs)) ? estado.prefs.ordenTabs : [];
    var base = {};
    out.forEach(function (id, i) { base[id] = i; });
    out.sort(function (a, b) {
      var ia = orden.indexOf(a), ib = orden.indexOf(b);
      if (ia < 0) ia = base[a] + 1000;
      if (ib < 0) ib = base[b] + 1000;
      return ia - ib;
    });
    var aj = out.indexOf("ajustes");
    if (aj >= 0) { out.splice(aj, 1); out.push("ajustes"); }
    return out;
  }
  function moverTab(origen, destino) {
    if (!origen || !destino || origen === destino || origen === "ajustes" || destino === "ajustes") return;
    var orden = secciones();
    var i = orden.indexOf(origen), j = orden.indexOf(destino);
    if (i < 0 || j < 0) return;
    orden.splice(i, 1);
    var pos = orden.indexOf(destino);
    if (i < j) pos += 1;
    orden.splice(pos, 0, origen);
    estado.prefs.ordenTabs = orden.filter(function (id) { return id !== "ajustes"; }).concat(["ajustes"]);
    guardar(); pintarTabs();
    var nuevo = $('#tabs .tab[data-ir="' + origen + '"]');
    if (nuevo) {
      nuevo.classList.add("tab-acomodo");
      setTimeout(function () { nuevo.classList.remove("tab-acomodo"); }, 320);
    }
  }

  function pintarTabs() {
    $("#tabs").innerHTML = secciones().map(function (id) {
      var on = id === pantalla ? " on" : "";
      return '<button class="tab' + on + '" type="button" role="tab" aria-selected="' + (id === pantalla) + '" data-ir="' + id + '" title="' + esc(nombre(id)) + '" aria-label="' + esc(nombre(id)) + '">' +
        icono(iconoDe(id)) + "</button>";
    }).join("");
    $$("#tabs .tab").forEach(function (b) {
      var id = b.getAttribute("data-ir");
      b.setAttribute("draggable", id === "ajustes" ? "false" : "true");
      b.addEventListener("click", function () { ir(id); });
      b.addEventListener("dragstart", function (e) {
        tabArrastrada = id;
        b.classList.add("arrastrando");
        try {
          e.dataTransfer.setData("text/plain", id);
          e.dataTransfer.effectAllowed = "move";
        } catch (_) {}
      });
      b.addEventListener("dragend", function () {
        b.classList.remove("arrastrando");
        tabArrastrada = null;
        $$(".tab-sobre").forEach(function (x) { x.classList.remove("tab-sobre"); });
        $$(".pane-soltar").forEach(function (x) { x.classList.remove("pane-soltar"); });
      });
      b.addEventListener("dragover", function (e) {
        if (!tabArrastrada || tabArrastrada === id || id === "ajustes") return;
        e.preventDefault(); b.classList.add("tab-sobre");
      });
      b.addEventListener("dragleave", function () { b.classList.remove("tab-sobre"); });
      b.addEventListener("drop", function (e) {
        e.preventDefault(); b.classList.remove("tab-sobre");
        moverTab(tabArrastrada, id);
      });
    });
    var kb = $("#kpi-bloques");
    if (kb) kb.textContent = String(estado.instalados.length);
    pintarAjustes();
  }

  function mostrarPaneles() {
    $$(".seccion[data-pantalla]").forEach(function (s) {
      var sid = s.getAttribute("data-pantalla");
      s.hidden = !(sid === pantalla || (splitOn && sid === estado.splitSeccion));
    });
  }
  function ctxDe(el) {
    return splitOn && el && el.closest && el.closest("#split-escena") ? estado.splitSeccion : pantalla;
  }
  function pintarPanelDe(ctx) {
    if (ctx === pantalla) pintarPanel(); else pintarPanelEn(ctx);
  }
  function ir(id) {
    if (secciones().indexOf(id) === -1) return;
    if (splitOn && Date.now() < splitNavHasta) {
      if (id === estado.splitSeccion) {
        if (id === "tareas") pintarTareas();
        else if (id === "notas") pintarNotas();
        else if (id === "calendario") pintarCalendario();
        else if (id === "malla") pintarMalla();
        else if (id === "calificaciones") pintarCalificaciones();
        else if (id === "estudio") pintarEstudio();
        else if (id === "tiempo") pintarTiempo();
        pintarPanelEn(id);
        return;
      }
      if (id === pantalla) return;
      estado.splitSeccion = id; guardar(); pintarSplit();
      return;
    }
    if (splitOn && id === estado.splitSeccion) {
      aviso(L("Esa sección ya está en la ventana derecha.", "That section is already in the right window.", "该分区已在右侧窗口。"));
      return;
    }
    pantalla = id;
    mostrarPaneles();
    pintarTabs();
    if (id === "malla") pintarMalla();
    if (id === "calificaciones") pintarCalificaciones();
    if (id === "estudio") pintarEstudio();
    if (id === "tiempo") pintarTiempo();
    pintarPanel();
    if (window.innerWidth <= 1255) cerrarPanel();
  }

  function temaModo(id) {
    var t = TEMAS.filter(function (x) { return x[0] === id; })[0];
    return t && t[2] === "claro" ? "claro" : "oscuro";
  }
  function temasDeModo(modo) {
    return TEMAS.filter(function (t) { return t[2] === modo; });
  }
  function nombreTema(id) {
    var t = TEMAS.filter(function (x) { return x[0] === id; })[0];
    if (!t) return id;
    var m = {
      clasico: ["Clásico", "Classic", "经典"],
      medianoche: ["Medianoche", "Midnight", "午夜"],
      negro: ["Negro", "Black", "纯黑"],
      vino: ["Vino", "Wine", "酒红"],
      bosque: ["Bosque", "Forest", "森林"],
      sepia: ["Sepia", "Sepia", "棕褐"],
      "alto-contraste-claro": ["Alto contraste claro", "Light high contrast", "浅色高对比"],
      "alto-contraste": ["Alto contraste oscuro", "Dark high contrast", "深色高对比"]
    }[id];
    return m ? L(m[0], m[1], m[2]) : t[1];
  }
  function aplicarTema(t, sinPareja) {
    t = temaValido(t, "clasico");
    document.body.setAttribute("data-tema", t);
    estado.tema = t;
    if (!estado.prefs) estado.prefs = {};
    if (!sinPareja) {
      if (temaModo(t) === "claro") estado.prefs.temaClaro = t;
      else estado.prefs.temaOscuro = t;
    }
    pintarTemas();
    pintarTemaIcono();
    guardar();
  }
  function pintarTemaIcono() {
    var b = $("#btn-tema");
    if (!b) return;
    var oscuro = temaModo(estado.tema) === "oscuro";
    var otro = oscuro ? (estado.prefs.temaClaro || "clasico") : (estado.prefs.temaOscuro || "deepsea");
    b.innerHTML = icono(oscuro ? "i-sol" : "i-luna");
    b.title = L("Cambiar a ", "Switch to ", "切换到 ") + (oscuro ? L("claro", "light", "浅色") : L("oscuro", "dark", "深色")) + " (" + nombreTema(otro) + ")";
  }
  function pintarTemas() {
    var c = $("#temas");
    if (!c) return;
    c.innerHTML = TEMAS.map(function (t) {
      return '<button class="tema" type="button" data-tema="' + t[0] + '" aria-pressed="' +
        (estado.tema === t[0]) + '"><i aria-hidden="true"></i><span class="tema-nombre">' + esc(nombreTema(t[0])) + "</span>" +
        '<small class="tema-modo">' + esc(t[2] === "claro" ? L("claro", "light", "浅色") : L("oscuro", "dark", "深色")) + "</small></button>";
    }).join("");
    $$("#temas .tema").forEach(function (b) {
      b.addEventListener("click", function () {
        aplicarTema(b.getAttribute("data-tema"));
        aviso(L("Tema ", "Theme ", "主题 ") + nombreTema(b.getAttribute("data-tema")) + L(" aplicado.", " applied.", " 已应用。"));
      });
    });
    var sc = $("#pref-tema-claro"), so = $("#pref-tema-oscuro");
    if (sc) {
      sc.innerHTML = temasDeModo("claro").map(function (t) { return '<option value="' + t[0] + '">' + esc(nombreTema(t[0])) + "</option>"; }).join("");
      sc.value = estado.prefs.temaClaro || "clasico";
    }
    if (so) {
      so.innerHTML = temasDeModo("oscuro").map(function (t) { return '<option value="' + t[0] + '">' + esc(nombreTema(t[0])) + "</option>"; }).join("");
      so.value = estado.prefs.temaOscuro || "deepsea";
    }
  }

  function normalizarEventos() {
    estado.eventos = (estado.eventos || []).map(function (e, i) {
      return {
        id: e.id || "e" + i,
        titulo: e.titulo || "Sin título",
        fecha: e.fecha || hoyISO(),
        hora: e.hora || "",
        contexto: e.contexto || "",
        nota: e.nota || ""
      };
    });
  }
  function eventoPorId(id) { return estado.eventos.filter(function (e) { return e.id === id; })[0] || null; }
  function eventosDe(fecha) {
    return estado.eventos.filter(function (e) { return e.fecha === fecha; })
      .sort(function (a, b) { return (a.hora || "99:99") < (b.hora || "99:99") ? -1 : 1; });
  }
  function isoFecha(f) {
    return f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
  }
  function semanaDePeriodo(iso) {
    var p = periodoActivoObj();
    if (!p || !Array.isArray(p.semanas) || !p.semanas.length) return null;
    var w = p.semanas.filter(function (x) { return iso >= x.desde && iso <= x.hasta; })[0];
    if (!w) return null;
    var tipo = w.tipo || "clases";
    var clases = p.semanas.filter(function (x) { return (x.tipo || "clases") === "clases"; });
    var idx = clases.indexOf(w);
    return {
      numero: tipo === "clases" && idx >= 0 ? idx + 1 : 0,
      tipo: tipo,
      n: w.n,
      desde: w.desde,
      hasta: w.hasta
    };
  }
  function chipEvento(e) {
    return '<button class="evento-chip" type="button" data-evento="' + e.id + '" title="' + esc(e.titulo) + ' · ' + esc(t("cal.clicDerecho")) + '">' +
      (e.hora ? '<b>' + esc(horaTexto(e.hora)) + "</b> " : "") + esc(e.titulo) + "</button>";
  }
  function pintarCalendario() {
    normalizarEventos();
    var hoy = new Date(), y = calCursor.getFullYear(), m = calCursor.getMonth();
    var total = estado.eventos.length;
    $("#kpi-eventos").textContent = String(total);
    $("#kpi-tareas").textContent = String(estado.tareas.filter(function (t) { return t.fecha; }).length);
    $$("#vista-calendario button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-cal-vista") === vistaCalendario);
    });
    var grid = $("#cal-grid"), agenda = $("#cal-agenda");
    agenda.hidden = vistaCalendario !== "agenda";
    grid.hidden = vistaCalendario === "agenda";
    var visibles = 0;
    if (vistaCalendario === "agenda") {
      var orden = estado.eventos.slice().sort(function (a, b) {
        return (a.fecha + " " + (a.hora || "")) < (b.fecha + " " + (b.hora || "")) ? -1 : 1;
      });
      visibles = orden.length;
      $("#cal-mes-titulo").textContent = t("cal.agenda");
      agenda.innerHTML = orden.length ? orden.map(function (e) {
        return '<button class="cal-agenda__item" type="button" data-evento="' + e.id + '" title="' + esc(t("cal.clicDerecho")) + '"><span><b>' + esc(e.titulo) + "</b><small>" + esc(e.fecha) + (e.hora ? " · " + esc(horaTexto(e.hora)) : "") + (e.contexto ? " · " + esc(e.contexto) : "") + "</small></span><span class=\"pill\">" + esc(e.fecha >= hoyISO() ? t("cal.proximo") : t("cal.pasado")) + "</span></button>";
      }).join("") : '<p class="empty">' + esc(t("cal.sinEventos")) + '</p>';
    } else if (vistaCalendario === "semana") {
      var lunes = new Date(calCursor.getFullYear(), calCursor.getMonth(), calCursor.getDate());
      var domingo = (estado.prefs || {}).inicioSemana === "domingo";
      lunes.setDate(lunes.getDate() - (domingo ? lunes.getDay() : ((lunes.getDay() + 6) % 7)));
      var domingo = (estado.prefs || {}).inicioSemana === "domingo";
      var dias = diasSemana();
      grid.className = "cal-grid cal-grid--semana";
      var semSemana = semanaDePeriodo(isoFecha(lunes)) || semanaDePeriodo(isoFecha(new Date(lunes.getTime() + 3 * 86400000)));
      var rotuloSemana = semSemana ? (semSemana.numero ? " · S" + semSemana.numero : semSemana.tipo === "receso" ? " · " + t("cal.receso") : semSemana.tipo === "examenes" ? " · " + t("cal.examenes") : "") : "";
      $("#cal-mes-titulo").textContent = t("cal.semanaDel") + " " + lunes.getDate() + "/" + (lunes.getMonth() + 1) + rotuloSemana;
      grid.innerHTML = dias.map(function (d, i) {
        var f = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
        var iso = f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
        var evs = eventosDe(iso); visibles += evs.length;
        return '<div class="cal-semana-dia' + (iso === hoyISO() ? " hoy" : "") + '" data-cal-dia="' + iso + '"><b>' + d + " " + f.getDate() + "</b>" +
          (evs.length ? evs.map(chipEvento).join("") : '<span class="cal-vacio-dia">—</span>') + "</div>";
      }).join("");
    } else {
      var primero = new Date(y, m, 1);
      var domingo = (estado.prefs || {}).inicioSemana === "domingo";
      var offset = domingo ? primero.getDay() : (primero.getDay() + 6) % 7;
      var inicio = new Date(y, m, 1 - offset);
      var dias2 = diasSemana();
      var periodoCal = periodoActivoObj();
      var conSemana = !!(periodoCal && Array.isArray(periodoCal.semanas) && periodoCal.semanas.length);
      grid.className = "cal-grid cal-grid--mes" + (conSemana ? " cal-grid--con-semana" : "");
      $("#cal-mes-titulo").textContent = new Date(y, m, 1).toLocaleDateString(localeActual(), { month: "long", year: "numeric" });
      var html = (conSemana ? '<div class="cal-dow cal-dow--sem">' + t("cal.semana") + "</div>" : "") +
        dias2.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
      for (var i = 0; i < 42; i++) {
        var f2 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        var iso2 = isoFecha(f2);
        if (i % 7 === 0) {
          if (conSemana) {
            var sem = semanaDePeriodo(iso2) || semanaDePeriodo(isoFecha(new Date(f2.getTime() + 3 * 86400000)));
            var etiqueta = sem ? (sem.numero ? "S" + sem.numero : sem.tipo === "receso" ? "REC" : sem.tipo === "examenes" ? "EX" : "—") : "—";
            var titulo = sem ? (sem.numero ? tf("cal.tituloSemana", { n: sem.numero }) : sem.tipo === "receso" ? t("cal.tituloReceso") : t("cal.tituloExamenes")) : t("cal.fueraPeriodo");
            if (sem) {
              html += '<button class="cal-sem-col tipo-' + sem.tipo + '" type="button" data-semana="' + sem.desde + '" title="' + esc(titulo) + '. ' + esc(t("cal.clicTipo")) + '">' + etiqueta + "</button>";
            } else {
              html += '<div class="cal-sem-col" title="' + esc(titulo) + '">' + etiqueta + "</div>";
            }
          }
        }
        var evs2 = eventosDe(iso2); if (f2.getMonth() === m) visibles += evs2.length;
        html += '<div class="cal-dia' + (f2.getMonth() !== m ? " fuera" : "") + (iso2 === hoyISO() ? " hoy" : "") + '" data-cal-dia="' + iso2 + '"><b>' + f2.getDate() + "</b>" +
          (evs2.length ? '<div class="cal-eventos">' + evs2.slice(0, 2).map(chipEvento).join("") + (evs2.length > 2 ? '<span class="cal-mas">+' + (evs2.length - 2) + "</span>" : "") + "</div>" : "") + "</div>";
      }
      grid.innerHTML = html;
      $$("#cal-grid [data-semana]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          cambiarTipoSemanaCalendario(b.getAttribute("data-semana"));
        });
      });
    }
    $("#cal-cuenta").textContent = visibles + " " + t(visibles === 1 ? "cal.evento" : "cal.eventos");
    $("#cal-vacio").hidden = visibles > 0;
    $$("#cal-grid [data-evento], #cal-agenda [data-evento]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.eventoSel = b.getAttribute("data-evento");
        var ctx = ctxDe(b);
        estado.panel[ctx] = "detalle";
        guardar(); pintarPanelDe(ctx); pintarCalendario();
        if (window.innerWidth <= 1255) abrirPanel();
      });
    });
  }
  function abrirEvento(ev) {
    normalizarEventos();
    formEventoId = ev ? ev.id : null;
    $("#evento-titulo").value = ev ? ev.titulo : "";
    $("#evento-fecha").value = ev ? ev.fecha : hoyISO();
    $("#evento-hora").value = ev ? ev.hora : "";
    $("#evento-contexto").value = ev ? ev.contexto : "";
    $("#evento-form").hidden = false;
    $("#evento-titulo").focus();
  }
  function borrarEvento(id) {
    var ev = eventoPorId(id); if (!ev) return;
    if (!window.confirm(L("¿Borrar \"" + ev.titulo + "\"?", "Delete \"" + ev.titulo + "\"?", "删除“" + ev.titulo + "”？"))) return;
    var copia = Object.assign({}, ev);
    estado.eventos = estado.eventos.filter(function (e) { return e.id !== id; });
    if (estado.eventoSel === id) estado.eventoSel = null;
    guardar(); pintarCalendario(); pintarPanel();
    aviso(L("Evento borrado.", "Event deleted.", "事件已删除。"), function () {
      estado.eventos.push(copia); estado.eventoSel = copia.id; guardar(); pintarCalendario(); pintarPanel(); aviso(L("Evento restaurado.", "Event restored.", "事件已恢复。"));
    });
  }

  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function selloLocal() {
    var d = new Date();
    return hoyISO() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function normalizarTareas() {
    estado.tareas = (estado.tareas || []).map(function (t, i) {
      var e = t.estado || (t.hecha ? "hecha" : "pendiente");
      return {
        id: t.id || "t" + i,
        titulo: t.titulo || "Sin título",
        tipo: t.tipo === "proyecto" ? "proyecto" : "tarea",
        padre_id: t.padre_id || null,
        estado: e,
        hecha: e === "hecha",
        prioridad: t.prioridad || "media",
        fecha: t.fecha || "",
        contexto: t.contexto || "",
        nota: t.nota || "",
        orden: typeof t.orden === "number" ? t.orden : i,
        creada: t.creada || ""
      };
    });
  }
  function tareaPorId(id) { return estado.tareas.filter(function (t) { return t.id === id; })[0] || null; }
  function hijosDe(id) { return estado.tareas.filter(function (t) { return t.padre_id === id; }); }
  function raicesTareas() {
    return estado.tareas.filter(function (t) { return !t.padre_id || !tareaPorId(t.padre_id); });
  }
  function profundidad(t) {
    var n = 0, p = t.padre_id, visto = {};
    while (p && !visto[p]) { visto[p] = 1; n++; var x = tareaPorId(p); p = x ? x.padre_id : null; }
    return n;
  }
  function descendientes(t) {
    var out = [], pila = hijosDe(t.id).slice();
    while (pila.length) {
      var x = pila.shift(); out.push(x);
      hijosDe(x.id).forEach(function (h) { pila.push(h); });
    }
    return out;
  }
  function progreso(t) {
    var ds = descendientes(t), hechas = ds.filter(function (x) { return x.hecha; }).length;
    var total = ds.length;
    return { total: total, hechas: hechas, pct: total ? Math.round(hechas / total * 100) : (t.hecha ? 100 : 0) };
  }
  function etiquetaPrioridad(p) {
    return p === "alta" ? L("Alta", "High", "高") : p === "baja" ? L("Baja", "Low", "低") : L("Media", "Medium", "中");
  }
  function fechaCorta(f) {
    if (!f) return L("sin fecha", "no date", "无日期");
    if (f === hoyISO()) return L("hoy", "today", "今天");
    var p = f.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] : f;
  }
  function filaTarea(t, nivel) {
    var p = progreso(t), hijos = hijosDe(t.id);
    var sub = t.tipo === "proyecto"
      ? '<span class="tarea-progreso" title="' + esc(L(p.hechas + " de " + p.total, p.hechas + " of " + p.total, p.hechas + "/" + p.total)) + '"><i style="width:' + p.pct + '%"></i></span><small class="tarea-pct">' + p.pct + "%</small>"
      : "";
    var html = '<div class="tarea-fila' + (estado.tareaSel === t.id ? " sel" : "") + '" data-tarea="' + t.id + '" role="button" tabindex="0" title="' + esc(tr("cal.clicDerecho")) + '" style="--nivel:' + nivel + '">' +
      '<button class="tarea-check' + (t.hecha ? " hecha" : "") + '" type="button" data-check="' + t.id + '" aria-label="' + esc(t.hecha ? L("Marcar abierta", "Mark open", "标为未完成") : L("Marcar hecha", "Mark done", "标为完成")) + '">' + (t.hecha ? "✓" : "") + "</button>" +
      '<span class="tarea-nom' + (t.hecha ? " hecha" : "") + '">' + esc(t.titulo) + (t.tipo === "proyecto" ? ' <small class="tarea-tipo">' + esc(L("proyecto", "project", "项目")) + '</small>' : "") + "</span>" +
      '<span class="tarea-meta">' + esc(fechaCorta(t.fecha)) + "</span>" +
      '<span class="pill pill--' + esc(t.prioridad) + '">' + esc(etiquetaPrioridad(t.prioridad)) + "</span>" + sub +
      '<button class="tarea-add" type="button" data-add-sub="' + t.id + '" title="' + esc(L("Agregar una tarea dentro", "Add a task inside", "添加子任务")) + '">+</button></div>';
    if (hijos.length) html += hijos.map(function (h) { return filaTarea(h, nivel + 1); }).join("");
    return html;
  }
  function tarjetaTablero(t) {
    var p = progreso(t);
    return '<button class="tarjeta-tarea' + (estado.tareaSel === t.id ? " sel" : "") + '" type="button" data-tarea="' + t.id + '" title="' + esc(tr("cal.clicDerecho")) + '">' +
      '<b>' + esc(t.titulo) + "</b><small>" + esc(fechaCorta(t.fecha)) + " · " + esc(t.contexto || L("sin contexto", "no context", "无情境")) + "</small>" +
      (t.tipo === "proyecto" ? '<span class="tarea-progreso"><i style="width:' + p.pct + '%"></i></span>' : "") + "</button>";
  }
  function bindTareas() {
    $$("#tareas-lista [data-tarea]").forEach(function (fila) {
      fila.addEventListener("click", function (ev) {
        if (ev.target.getAttribute("data-check") || ev.target.getAttribute("data-add-sub")) return;
        estado.tareaSel = fila.getAttribute("data-tarea");
        var ctx = ctxDe(fila);
        estado.panel[ctx] = "detalle";
        guardar(); pintarTareas(); pintarPanelDe(ctx);
        if (window.innerWidth <= 1255) abrirPanel();
      });
      fila.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fila.click(); }
      });
    });
    $$("#tareas-lista [data-check]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var t = tareaPorId(b.getAttribute("data-check"));
        if (!t) return;
        var marcar = !t.hecha;
        t.hecha = marcar; t.estado = marcar ? "hecha" : "pendiente";
        if (marcar && t.tipo === "proyecto") descendientes(t).forEach(function (h) { h.hecha = true; h.estado = "hecha"; });
        guardar(); pintarTareas(); pintarPanel();
      });
    });
    $$("#tareas-lista [data-add-sub]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var padre = b.getAttribute("data-add-sub");
        abrirFormulario(null, padre);
      });
    });
  }
  function pintarTareas() {
    normalizarTareas();
    var lista = $("#tareas-lista"), vacio = $("#tareas-vacio"), tareas = estado.tareas;
    var hoy = tareas.filter(function (t) { return !t.hecha && t.fecha === hoyISO(); });
    var abiertas = tareas.filter(function (t) { return !t.hecha; });
    var hechas = tareas.filter(function (t) { return t.hecha; });
    $("#kpi-hoy").textContent = String(hoy.length);
    $("#kpi-abiertas").textContent = String(abiertas.length);
    $("#kpi-hechas").textContent = String(hechas.length);
    $("#kpi-progreso").textContent = (tareas.length ? Math.round(hechas.length / tareas.length * 100) : 0) + " %";
    if (!tareas.length) { lista.innerHTML = ""; vacio.hidden = false; return; }
    vacio.hidden = true;
    if (vistaTareas === "arbol") {
      lista.innerHTML = raicesTareas().map(function (t) { return filaTarea(t, 0); }).join("");
    } else if (vistaTareas === "tablero") {
      var lunes = new Date(); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
      var domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      var iso = function (d) { return d.toISOString().slice(0, 10); };
      var colHoy = tareas.filter(function (t) { return !t.hecha && (!t.fecha || t.fecha <= hoyISO()); });
      var colSemana = tareas.filter(function (t) { return !t.hecha && t.fecha > hoyISO(); });
      var colHechas = tareas.filter(function (t) { return t.hecha; });
      var col = function (titulo, items) {
        return '<div class="tablero-col"><h3>' + titulo + " <span>" + items.length + "</span></h3>" + (items.map(tarjetaTablero).join("") || '<p class="muted">' + esc(L("Nada.", "Nothing.", "没有。")) + '</p>') + "</div>";
      };
      lista.innerHTML = '<div class="tablero">' + col(L("Hoy / atrasadas", "Today / overdue", "今天 / 逾期"), colHoy) + col(L("Próximas", "Upcoming", "即将到来"), colSemana) + col(L("Hechas", "Done", "已完成"), colHechas) + "</div>";
    } else {
      var v = tareas.filter(function (t) { return !t.hecha && t.fecha && t.fecha <= hoyISO(); });
      lista.innerHTML = v.length ? v.map(function (t) { return filaTarea(t, 0); }).join("") : '<p class="muted">' + esc(L("Nada para hoy. Cambia a Árbol o Tablero.", "Nothing for today. Switch to Tree or Board.", "今天没有任务。请切换到树状或看板。")) + '</p>';
    }
    bindTareas();
  }
  var formEditId = null;
  function opcionesPadre(t) {
    var excluir = {};
    if (t) { excluir[t.id] = 1; descendientes(t).forEach(function (x) { excluir[x.id] = 1; }); }
    return '<option value="">' + esc(L("Sin padre", "No parent", "无父任务")) + '</option>' + estado.tareas.filter(function (x) {
      return !excluir[x.id] && profundidad(x) < 4;
    }).map(function (x) {
      return '<option value="' + x.id + '">' + esc("— ".repeat(profundidad(x)) + (x.tipo === "proyecto" ? L("Proyecto: ", "Project: ", "项目：") : "") + x.titulo) + "</option>";
    }).join("");
  }
  function abrirFormulario(t, padreId) {
    normalizarTareas();
    formEditId = t ? t.id : null;
    $("#tarea-titulo").value = t ? t.titulo : "";
    $("#tarea-tipo").value = t ? t.tipo : "tarea";
    $("#tarea-padre").innerHTML = opcionesPadre(t);
    $("#tarea-padre").value = t ? (t.padre_id || "") : (padreId || "");
    $("#tarea-fecha").value = t ? t.fecha : hoyISO();
    $("#tarea-prioridad").value = t ? t.prioridad : "media";
    $("#tarea-contexto").value = t ? t.contexto : "";
    $("#tarea-form").hidden = false;
    $("#tarea-form button[type=submit]").textContent = t ? L("Guardar", "Save", "保存") : L("Crear", "Create", "创建");
    $("#tarea-titulo").focus();
  }
  function borrarTarea(id) {
    var t = tareaPorId(id); if (!t) return;
    var familia = [t.id].concat(descendientes(t).map(function (x) { return x.id; }));
    if (!window.confirm(L("¿Borrar \"" + t.titulo + "\" y sus " + (familia.length - 1) + " tareas dentro?", "Delete \"" + t.titulo + "\" and its " + (familia.length - 1) + " tasks inside?", "删除“" + t.titulo + "”及其中的 " + (familia.length - 1) + " 个任务？"))) return;
    estado.tareas = estado.tareas.filter(function (x) { return familia.indexOf(x.id) === -1; });
    if (familia.indexOf(estado.tareaSel) !== -1) estado.tareaSel = null;
    guardar(); pintarTareas(); pintarPanel(); aviso(L("Tarea borrada.", "Task deleted.", "任务已删除。"));
  }

  /* ---- U4a: Malla de cursos, niveles, prerrequisitos y créditos ---- */
  var formRamoId = null, mallaBusqueda = "", mallaFiltro = "todos", mallaRapido = false;

  function normalizarCursos() {
    var vistos = {}, out = [];
    (estado.cursos || []).forEach(function (c) {
      if (!c || typeof c !== "object") return;
      var cod = String(c.codigo || "").trim().toUpperCase();
      if (!cod || vistos[cod]) return;
      vistos[cod] = 1;
      var reqs = Array.isArray(c.requisitos) ? c.requisitos : [];
      reqs = reqs.map(function (r) { return String(r || "").trim().toUpperCase(); })
        .filter(function (r) { return r && r !== cod; });
      reqs = reqs.filter(function (r, i) { return reqs.indexOf(r) === i; });
      var grupos = Array.isArray(c.requisitos_o) ? c.requisitos_o : [];
      grupos = grupos.map(function (g) {
        var lista = Array.isArray(g) ? g : [g];
        return lista.map(function (r) { return String(r || "").trim().toUpperCase(); })
          .filter(function (r) { return r && r !== cod; });
      }).filter(function (g) { return g.length; });
      var nivel = parseInt(c.nivel, 10);
      if (!nivel || nivel < 1) nivel = String(c.tipo || "") === "cupo" ? 99 : 1;
      if (nivel > 99) nivel = 99;
      var cerrado = c.cerrado !== undefined ? !!c.cerrado : !!c.aprobado;
      var aprobado = !!c.aprobado && cerrado;
      var resultado = cerrado ? String(c.resultado || (aprobado ? "aprobado" : "reprobado")) : "";
      out.push({
        codigo: cod, nombre: String(c.nombre || cod).trim() || cod,
        creditos: Math.max(0, parseInt(c.creditos, 10) || 0), nivel: nivel,
        requisitos: reqs, requisitos_o: grupos, aprobacion: Number(c.aprobacion) || null,
        tipo: String(c.tipo || ""), enMalla: c.enMalla !== false && c.en_malla !== false,
        cerrado: cerrado, aprobado: aprobado, resultado: resultado,
        notaCierre: c.notaCierre === null || c.notaCierre === undefined ? null : Number(c.notaCierre),
        cerradoEn: String(c.cerradoEn || ""),
        enCurso: !!c.enCurso && !cerrado
      });
    });
    estado.cursos = out;
  }
  function ramoPorCodigo(cod) {
    var c = String(cod || "").trim().toUpperCase();
    return (estado.cursos || []).filter(function (x) { return x.codigo === c; })[0] || null;
  }
  function creditosDe(c) { return Number(c.creditos) || 0; }
  function etiquetaNivel(n) { return Number(n) === 99 ? L("Electivos", "Electives", "选修") : L("Nivel ", "Level ", "层级 ") + n; }
  function etiquetaEstado(e) {
    return { aprobado: L("aprobado", "passed", "已通过"), curso: L("en curso", "in progress", "进行中"),
      disponible: L("disponible", "available", "可选"), bloqueado: L("bloqueado", "locked", "已锁定"),
      reprobado: L("reprobado", "failed", "未通过") }[e] || e;
  }
  function requisitosTexto(c) {
    var reqs = (c.requisitos || []).slice();
    (c.requisitos_o || []).forEach(function (g) { reqs.push(g.join(L(" o ", " or ", " 或 "))); });
    return reqs.join(" · ");
  }
  // aprobado manda; si no, en curso; si no, disponible solo cuando TODOS los requisitos
  // (y al menos uno de cada grupo "o") están aprobados. Un código que no existe bloquea.
  function estadoDeRamo(c, visto) {
    if (!c) return "bloqueado";
    if (c.cerrado) return c.aprobado ? "aprobado" : "reprobado";
    if (visto && visto[c.codigo]) return "bloqueado";
    if (c.enCurso) return "curso";
    var reqs = c.requisitos || [], grupos = c.requisitos_o || [];
    if (!reqs.length && !grupos.length) return "disponible";
    var v2 = Object.assign({}, visto || {}); v2[c.codigo] = 1;
    var ok = reqs.every(function (r) {
      var x = ramoPorCodigo(r);
      return !!x && estadoDeRamo(x, v2) === "aprobado";
    });
    (grupos || []).forEach(function (g) {
      if (!ok) return;
      var uno = g.some(function (r) {
        var x = ramoPorCodigo(r);
        return !!x && estadoDeRamo(x, v2) === "aprobado";
      });
      if (!uno) ok = false;
    });
    return ok ? "disponible" : "bloqueado";
  }
  function faltantesDe(c) {
    var out = [];
    (c.requisitos || []).forEach(function (r) {
      var x = ramoPorCodigo(r);
      if (!x || estadoDeRamo(x) !== "aprobado") out.push(r);
    });
    (c.requisitos_o || []).forEach(function (g) {
      var uno = g.some(function (r) { var x = ramoPorCodigo(r); return !!x && estadoDeRamo(x) === "aprobado"; });
      if (!uno) out.push(g.join(" o "));
    });
    return out;
  }
  function iconoEstado(e) {
    return { aprobado: "i-check", curso: "i-play", disponible: "i-plus", bloqueado: "i-lock", reprobado: "i-x" }[e] || "i-plus";
  }
  function desbloqueaDe(cod) {
    return estado.cursos.filter(function (x) {
      if (x.enMalla === false) return false;
      return (x.requisitos || []).indexOf(cod) !== -1 ||
        (x.requisitos_o || []).some(function (g) { return g.indexOf(cod) !== -1; });
    });
  }
  function chipRamo(cod, alternativa) {
    if (!cod) return '<span class="pt-chip bloqueado">' + esc(alternativa) + "</span>";
    var c = ramoPorCodigo(cod);
    var e = c ? estadoDeRamo(c) : "bloqueado";
    return '<button class="pt-chip ' + e + '" type="button" data-chip-ramo="' + esc(cod) + '">' + esc(alternativa || cod) + "</button>";
  }
  function detalleMallaHTML() {
    var c = ramoPorCodigo(estado.ramoSel);
    if (!c) {
      return '<div class="malla-detalle__vacio"><span class="malla-detalle__icono">' + icono("i-malla") +
        "</span><div><b>" + esc(L("Elige un ramo", "Pick a course", "选择一门课程")) + "</b><p>" + esc(L("Las líneas tenues muestran todos los prerrequisitos. Al elegir uno, el grafo enciende en azul lo que necesita y en naranjo lo que desbloquea.", "Faint lines show all prerequisites. Pick one and the graph lights blue what it needs and orange what it unlocks.", "浅色线显示所有先修要求。选择后，图表会用蓝色标出所需、橙色标出可解锁。")) + "</p></div></div>";
    }
    var e = estadoDeRamo(c), faltan = faltantesDe(c);
    var antes = [];
    (c.requisitos || []).forEach(function (r) {
      if (antes.map(function (x) { return x.cod; }).indexOf(r) === -1) antes.push({ cod: r, txt: r });
    });
    (c.requisitos_o || []).forEach(function (g) {
      antes.push({ cod: g.length === 1 ? g[0] : null, txt: g.join(" o ") });
    });
    var desp = desbloqueaDe(c.codigo);
    var aprob = Number(c.aprobacion);
    return '<div class="malla-detalle__cab"><div><span class="malla-detalle__cod">' + esc(c.codigo) + "</span>" +
      "<h3>" + esc(c.nombre) + "</h3><p>" + creditosDe(c) + " cr · " + esc(etiquetaNivel(c.nivel)) +
      " · <b class=\"malla-estado-" + e + "\">" + esc(etiquetaEstado(e)) + "</b>" +
      (aprob ? " · " + Math.round(aprob) + esc(L(" % de aprobación", "% approval", "% 通过率")) : "") + "</p></div>" +
      '<div class="fila"><button class="btn btn--chico" type="button" data-malla-editar="' + esc(c.codigo) + '">' + esc(L("Editar", "Edit", "编辑")) + '</button>' +
      '<button class="btn btn--chico" type="button" data-malla-limpiar>' + esc(L("Quitar selección", "Clear selection", "清除选择")) + '</button></div></div>' +
      '<div class="malla-chips"><div><b>' + esc(L("Antes necesitas", "You need first", "先修要求")) + '</b>' +
      (antes.length ? antes.map(function (x) { return chipRamo(x.cod, x.txt); }).join("") : '<span class="muted">' + esc(L("Sin prerrequisitos.", "No prerequisites.", "没有先修要求。")) + '</span>') +
      "</div><div><b>" + esc(L("Este ramo desbloquea", "This course unlocks", "此课程解锁")) + "</b>" +
      (desp.length ? desp.map(function (x) { return chipRamo(x.codigo, x.codigo); }).join("") : '<span class="muted">' + esc(L("No desbloquea otro ramo del plan.", "It does not unlock another course in the plan.", "它不会解锁规划中的其他课程。")) + '</span>') +
      "</div></div>" +
      (faltan.length ? '<p class="malla-falta">' + esc(L("Todavía falta: ", "Still missing: ", "还缺：")) + esc(faltan.join(", ")) + "</p>" : "");
  }
  function pintarMalla() {
    var cols = $("#malla-cols"); if (!cols) return;
    normalizarCursos();
    var cursos = estado.cursos.filter(function (c) { return c.enMalla !== false; });
    var total = 0, aprobCred = 0, aprobN = 0, cursoN = 0, libres = 0;
    var cuenta = { aprobado: 0, curso: 0, disponible: 0, bloqueado: 0, reprobado: 0 };
    cursos.forEach(function (c) {
      var e = estadoDeRamo(c);
      total += creditosDe(c);
      cuenta[e] = (cuenta[e] || 0) + 1;
      if (e === "aprobado") aprobCred += creditosDe(c);
      if (e === "aprobado" && c.tipo !== "cupo") aprobN++;
      if (e === "curso") cursoN++;
      if (e === "disponible" && c.tipo !== "cupo") libres++;
    });
    var pct = total ? Math.round(aprobCred / total * 100) : 0;
    if ($("#malla-k-creditos")) $("#malla-k-creditos").textContent = aprobCred + " / " + total;
    if ($("#malla-k-pct")) $("#malla-k-pct").textContent = pct + " %";
    if ($("#malla-k-ramos")) $("#malla-k-ramos").textContent = aprobN + (cursoN ? " · " + cursoN + " " + L("curso", "course", "门课程") : "");
    if ($("#malla-k-libres")) $("#malla-k-libres").textContent = String(libres);
    if ($("#malla-progreso-barra")) $("#malla-progreso-barra").style.width = pct + "%";
    if ($("#malla-progreso-txt")) $("#malla-progreso-txt").textContent = pct + " %";
    var pg = $(".malla-progreso"); if (pg) pg.setAttribute("aria-valuenow", String(pct));
    Object.keys(cuenta).forEach(function (k) { var el = $("#malla-lg-" + k); if (el) el.textContent = String(cuenta[k]); });
    var nivelesTodos = {};
    cursos.forEach(function (c) { nivelesTodos[c.nivel] = 1; });
    if ($("#malla-niveles-cuenta")) $("#malla-niveles-cuenta").textContent = Object.keys(nivelesTodos).length + " " + L("niveles", "levels", "个层级");
    var vacio = $("#malla-vacio"), scroll = $("#malla-scroll"), detalle = $("#malla-detalle");
    if (!cursos.length) {
      if (vacio) vacio.hidden = false;
      if (scroll) scroll.hidden = true;
      if (detalle) { detalle.hidden = true; detalle.innerHTML = ""; }
      cols.innerHTML = "";
      var svg0 = $("#malla-lineas"); if (svg0) svg0.innerHTML = "";
      return;
    }
    if (vacio) vacio.hidden = true;
    if (scroll) scroll.hidden = false;
    if (detalle) detalle.hidden = false;
    if (estado.ramoSel && !ramoPorCodigo(estado.ramoSel)) estado.ramoSel = null;
    if ($("#malla-quitar-sel")) $("#malla-quitar-sel").hidden = !estado.ramoSel;
    if ($("#malla-pista")) $("#malla-pista").textContent = estado.ramoSel
      ? L("Ves solo las líneas de este ramo: azul lo que necesita, naranjo lo que desbloquea. Vuelve a presionarlo para quitar la selección.", "You only see this course's lines: blue what it needs, orange what it unlocks. Press it again to clear the selection.", "只显示这门课程的线：蓝色是所需，橙色是解锁。再次按下可清除选择。")
      : L("Las líneas tenues son prerrequisitos. Elige un ramo para encender solo las suyas: azul lo que necesita, naranjo lo que desbloquea.", "Faint lines are prerequisites. Pick a course to light only its own: blue what it needs, orange what it unlocks.", "浅色线是先修要求。选择课程只点亮它的线：蓝色是需要，橙色是解锁。");
    var q = mallaBusqueda.toLowerCase();
    var visibles = cursos.filter(function (c) {
      var e = estadoDeRamo(c);
      if (mallaFiltro === "aprobados" && e !== "aprobado") return false;
      if (mallaFiltro === "disponibles" && e !== "disponible") return false;
      if (mallaFiltro === "bloqueados" && e !== "bloqueado") return false;
      if (mallaFiltro === "curso" && e !== "curso") return false;
      return !q || (c.codigo + " " + c.nombre).toLowerCase().indexOf(q) !== -1;
    });
    if (!visibles.length) {
      cols.innerHTML = '<p class="muted malla-sin">' + esc(L("Ningún ramo coincide con el filtro.", "No course matches the filter.", "没有课程符合筛选条件。")) + '</p>';
      var svg1 = $("#malla-lineas"); if (svg1) svg1.innerHTML = "";
      if (detalle) detalle.innerHTML = detalleMallaHTML();
      return;
    }
    var niveles = {};
    visibles.forEach(function (c) { (niveles[c.nivel] = niveles[c.nivel] || []).push(c); });
    cols.innerHTML = Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
      var lista = niveles[n].slice().sort(function (a, b) { return a.codigo < b.codigo ? -1 : 1; });
      var cr = lista.reduce(function (a, c) { return a + creditosDe(c); }, 0);
      return '<section class="malla-col" data-nivel="' + n + '"><header class="malla-col__cab"><b>' + esc(etiquetaNivel(n)) +
        "</b><span>" + cr + " cr · " + lista.length + " " + esc(L("ramo", "course", "门课程")) + "</span></header>" +
        '<div class="malla-col__nodos">' + lista.map(function (c) {
          var e = estadoDeRamo(c), req = requisitosTexto(c), faltan = faltantesDe(c);
          var titulo = c.nombre + (req ? " · " + L("requiere ", "requires ", "需要 ") + req : "") + (faltan.length ? " · " + L("faltan: ", "missing: ", "缺少：") + faltan.join(", ") : "");
          return '<button class="ramo-card ramo-card--' + e + (c.codigo === estado.ramoSel ? ' sel' : '') + '" type="button" data-ramo="' + esc(c.codigo) + '" title="' + esc(titulo) + '">' +
            '<span class="ramo-card__top"><b>' + esc(c.codigo) + '</b><span class="ramo-card__ico">' + icono(iconoEstado(e)) + "</span></span>" +
            '<span class="ramo-card__nom">' + esc(c.nombre) + "</span>" +
            '<span class="ramo-card__meta">' + creditosDe(c) + " cr</span>" +
            '<span class="ramo-card__est">' + esc(etiquetaEstado(e)) + "</span></button>";
        }).join("") + "</div></section>";
    }).join("");
    $$("#malla-cols [data-ramo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cod = b.getAttribute("data-ramo");
        if (mallaRapido) { alternarRamo(cod); return; }
        estado.ramoSel = estado.ramoSel === cod ? null : cod;
        estado.panel.malla = "detalle";
        guardar(); pintarMalla(); pintarPanel();
        if (window.innerWidth <= 1255 && estado.ramoSel) abrirPanel();
      });
    });
    if (detalle) detalle.innerHTML = detalleMallaHTML();
    $$("#malla-detalle [data-chip-ramo]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.ramoSel = b.getAttribute("data-chip-ramo"); estado.panel.malla = "detalle";
        guardar(); pintarMalla(); pintarPanel();
      });
    });
    var ed = $("#malla-detalle [data-malla-editar]");
    if (ed) ed.addEventListener("click", function () { abrirFormularioRamo(ramoPorCodigo(ed.getAttribute("data-malla-editar"))); });
    var limpiar = $("#malla-detalle [data-malla-limpiar]");
    if (limpiar) limpiar.addEventListener("click", limpiarSeleccionMalla);
    if (window.requestAnimationFrame) window.requestAnimationFrame(dibujarLineasMalla); else setTimeout(dibujarLineasMalla, 30);
  }
  function limpiarSeleccionMalla() {
    estado.ramoSel = null; guardar(); pintarMalla(); pintarPanel();
  }
  function dibujarLineasMalla() {
    var cont = $("#malla-tablero"), svg = $("#malla-lineas");
    if (!cont || !svg) return;
    var ancho = Math.max(cont.scrollWidth, cont.clientWidth), alto = Math.max(cont.scrollHeight, cont.clientHeight);
    if (!ancho || !alto) return;
    svg.setAttribute("viewBox", "0 0 " + ancho + " " + alto);
    svg.setAttribute("width", ancho); svg.setAttribute("height", alto);
    var caja = cont.getBoundingClientRect(), nodos = {};
    $$("#malla-cols [data-ramo]").forEach(function (el) { nodos[el.getAttribute("data-ramo")] = el; });
    var sel = estado.ramoSel, partes = [];
    estado.cursos.forEach(function (c) {
      var destino = nodos[c.codigo]; if (!destino) return;
      var reqs = (c.requisitos || []).slice();
      (c.requisitos_o || []).forEach(function (g) {
        g.forEach(function (r) { if (reqs.indexOf(r) === -1) reqs.push(r); });
      });
      reqs.forEach(function (req) {
        var origen = nodos[req]; if (!origen) return;
        var clase = sel ? (c.codigo === sel ? "req" : req === sel ? "des" : "tenue") : "tenue";
        var a = origen.getBoundingClientRect(), b = destino.getBoundingClientRect();
        var x1 = a.right - caja.left, y1 = a.top + a.height / 2 - caja.top;
        var x2 = b.left - caja.left, y2 = b.top + b.height / 2 - caja.top;
        var dx = Math.max(18, Math.abs(x2 - x1) * 0.45);
        var d = "M" + x1.toFixed(1) + " " + y1.toFixed(1) + " C" + (x1 + dx).toFixed(1) + " " + y1.toFixed(1) + " " +
          (x2 - dx).toFixed(1) + " " + y2.toFixed(1) + " " + x2.toFixed(1) + " " + y2.toFixed(1);
        partes.push('<path class="malla-linea malla-linea--' + clase + '" d="' + d + '"/>');
      });
    });
    svg.innerHTML = partes.join("");
  }
  function alternarRamo(cod) {
    var c = ramoPorCodigo(cod); if (!c) return;
    if (c.cerrado) { reabrirCurso(cod); return; }
    var q = califDe(cod), P = presentacionDe(q), nf = notaFinalDe(q);
    if (P === null) {
      if (!window.confirm(L("\"" + c.codigo + "\" no tiene notas. ¿Marcarlo como aprobado manualmente y cerrar el curso?", "\"" + c.codigo + "\" has no grades. Mark it as passed manually and close the course?", "“" + c.codigo + "”没有成绩。要手动标为已通过并关闭课程吗？"))) return;
      c.cerrado = true; c.aprobado = true; c.resultado = "aprobado";
      c.notaCierre = null; c.cerradoEn = selloLocal(); c.enCurso = false;
      guardar(); pintarMalla(); pintarCalificaciones(); pintarPanel();
      aviso(c.codigo + L(" cerrado como aprobado (sin notas).", " closed as passed (no grades).", " 已关闭为通过（无成绩）。"));
      return;
    }
    if (nf === null) { aviso(L("Falta la nota del examen o la eximición para cerrar el curso.", "The exam grade or the exemption is missing to close the course.", "缺少考试或免考成绩，无法关闭课程。")); return; }
    cerrarCurso(cod);
  }
  function cerrarCurso(cod) {
    var c = ramoPorCodigo(cod); if (!c) return;
    if (c.cerrado) { aviso(L("El curso ya está cerrado.", "The course is already closed.", "课程已关闭。")); return; }
    var q = califDe(cod), P = presentacionDe(q), nf = notaFinalDe(q);
    if (P === null) { aviso(L("No hay notas para calcular el resultado del curso.", "There are no grades to calculate the course result.", "没有成绩可计算课程结果。")); return; }
    if (nf === null) { aviso(L("Falta la nota del examen o la eximición para cerrar el curso.", "The exam grade or the exemption is missing to close the course.", "缺少考试或免考成绩，无法关闭课程。")); return; }
    var res = nf >= q.notaMin ? "aprobado" : "reprobado";
    if (!window.confirm(L("¿Cerrar \"" + c.codigo + " — " + c.nombre + "\" con final " + fmtNota(nf) + "? Quedará " + res.toUpperCase() + ".", "Close \"" + c.codigo + " — " + c.nombre + "\" with a final grade of " + fmtNota(nf) + "? It will be " + res.toUpperCase() + ".", "以 " + fmtNota(nf) + " 的最终成绩关闭“" + c.codigo + " — " + c.nombre + "”？结果将为 " + res.toUpperCase() + "。"))) return;
    c.cerrado = true; c.aprobado = res === "aprobado"; c.resultado = res;
    c.notaCierre = Math.round(nf * 10) / 10; c.cerradoEn = selloLocal(); c.enCurso = false;
    guardar(); pintarMalla(); pintarCalificaciones(); pintarPanel();
    aviso(L("Curso cerrado: ", "Course closed: ", "课程已关闭：") + etiquetaEstado(res) + " · " + fmtNota(nf));
  }
  function reabrirCurso(cod) {
    var c = ramoPorCodigo(cod); if (!c || !c.cerrado) return;
    if (!window.confirm(L("¿Reabrir \"" + c.codigo + " — " + c.nombre + "\"? Dejará de contar como " + (c.aprobado ? "aprobado" : "reprobado") + " y volverá a en curso.", "Reopen \"" + c.codigo + " — " + c.nombre + "\"? It will stop counting as " + (c.aprobado ? "passed" : "failed") + " and return to in progress.", "重新打开“" + c.codigo + " — " + c.nombre + "”？它将不再计为" + (c.aprobado ? "已通过" : "未通过") + "，并回到进行中。"))) return;
    c.cerrado = false; c.aprobado = false; c.resultado = "";
    c.notaCierre = null; c.cerradoEn = ""; c.enCurso = true;
    guardar(); pintarMalla(); pintarCalificaciones(); pintarPanel();
    aviso(L("Curso reabierto. Sus notas siguen ahí.", "Course reopened. Its grades are still there.", "课程已重新打开。成绩仍然保留。"));
  }
  function abrirFormularioRamo(c) {
    normalizarCursos();
    formRamoId = c ? c.codigo : null;
    $("#ramo-codigo").value = c ? c.codigo : "";
    $("#ramo-nombre").value = c ? c.nombre : "";
    $("#ramo-creditos").value = c ? c.creditos : 6;
    $("#ramo-nivel").value = c ? c.nivel : 1;
    $("#ramo-requisitos").value = c ? (c.requisitos || []).join(", ") : "";
    $("#ramo-aprobado").checked = !!(c && c.cerrado && c.aprobado);
    $("#ramo-curso").checked = !!(c && !c.cerrado && c.enCurso);
    $("#ramo-form").hidden = false;
    $("#ramo-form button[type=submit]").textContent = c ? L("Guardar", "Save", "保存") : L("Crear", "Create", "创建");
    $("#ramo-codigo").focus(); $("#ramo-codigo").select();
  }
  function cerrarFormularioRamo() {
    var f = $("#ramo-form"); if (f) f.hidden = true;
    formRamoId = null;
  }
  function borrarRamo(cod) {
    normalizarCursos();
    var c = ramoPorCodigo(cod); if (!c) return;
    var dependientes = estado.cursos.filter(function (x) {
      return (x.requisitos || []).indexOf(cod) !== -1 ||
        (x.requisitos_o || []).some(function (g) { return g.indexOf(cod) !== -1; });
    }).length;
    if (!window.confirm(L("¿Borrar \"" + c.codigo + " — " + c.nombre + "\"? Se borran también sus calificaciones." + (dependientes ? " Se quitará de los requisitos de " + dependientes + " ramo(s)." : ""), "Delete \"" + c.codigo + " — " + c.nombre + "\"? Its grades will also be deleted." + (dependientes ? " It will be removed from the prerequisites of " + dependientes + " course(s)." : ""), "删除“" + c.codigo + " — " + c.nombre + "”？其成绩也会被删除。" + (dependientes ? " 它将从 " + dependientes + " 门课程的先修要求中移除。" : "")))) return;
    estado.cursos = estado.cursos.filter(function (x) { return x.codigo !== cod; });
    if (estado.califs) delete estado.califs[cod];
    estado.cursos.forEach(function (x) {
      x.requisitos = (x.requisitos || []).filter(function (r) { return r !== cod; });
      x.requisitos_o = (x.requisitos_o || []).map(function (g) {
        return g.filter(function (r) { return r !== cod; });
      }).filter(function (g) { return g.length; });
    });
    if (estado.ramoSel === cod) estado.ramoSel = null;
    guardar(); pintarMalla(); pintarPanel(); aviso(L("Ramo borrado.", "Course deleted.", "课程已删除。"));
  }
  function cursosDesdeDoc(doc) {
    var raw = [], aprob = {}, enCurso = {};
    if (doc && doc.estado && typeof doc.estado === "object") {
      var act = doc.estado.activo;
      var sem = (doc.estado.sem || {})[act] || {};
      (sem.ramos || []).forEach(function (r) { if (r && r.codigo) enCurso[String(r.codigo).toUpperCase()] = 1; });
      ((doc.estado.agregados || {})[act] || []).forEach(function (r) { if (r && r.codigo) enCurso[String(r.codigo).toUpperCase()] = 1; });
    }
    if (doc && doc.datos && Array.isArray(doc.datos.cursos)) {
      raw = doc.datos.cursos;
      var ap = doc.datos.aprobados;
      if (Array.isArray(ap)) ap.forEach(function (c) { aprob[c] = 1; });
      else if (ap && typeof ap === "object") aprob = ap;
    } else if (doc && doc.estado && doc.estado.catalogo && typeof doc.estado.catalogo === "object") {
      raw = Object.keys(doc.estado.catalogo).map(function (k) {
        return Object.assign({ codigo: k }, doc.estado.catalogo[k]);
      });
      aprob = doc.estado.aprobados || {};
    } else if (doc && Array.isArray(doc.cursos)) {
      raw = doc.cursos;
    } else return null;
    return raw.map(function (c) {
      if (!c || typeof c !== "object") return null;
      var cod = String(c.codigo || c.code || "").trim().toUpperCase();
      if (!cod) return null;
      return {
        codigo: cod, nombre: c.nombre || c.name || cod,
        creditos: parseInt(c.creditos || c.credits, 10) || 0,
        nivel: parseInt(c.nivel, 10) || 0,
        aprobacion: Number(c.aprobacion) || null,
        tipo: String(c.tipo || ""), enMalla: c.en_malla !== false,
        requisitos: Array.isArray(c.requisitos) ? c.requisitos : [],
        requisitos_o: Array.isArray(c.requisitos_o) ? c.requisitos_o : [],
        aprobado: !!(c.aprobado || (Array.isArray(aprob) ? aprob.indexOf(cod) !== -1 : aprob[cod])),
        enCurso: !!c.enCurso || c.estado === "curso" || !!enCurso[cod]
      };
    }).filter(Boolean);
  }
  function importarMalla(file) {
    var lector = new FileReader();
    lector.onload = function () {
      try {
        var cursos = cursosDesdeDoc(JSON.parse(lector.result));
        if (!cursos || !cursos.length) { aviso(L("El archivo no trae cursos de malla.", "The file has no degree-plan courses.", "文件中没有课程规划。")); return; }
        if (estado.cursos.length && !window.confirm(L("¿Reemplazar la malla actual (" + estado.cursos.length + " ramos) por " + cursos.length + "?", "Replace the current plan (" + estado.cursos.length + " courses) with " + cursos.length + "?", "用 " + cursos.length + " 门课程替换当前规划（" + estado.cursos.length + " 门）？"))) return;
        estado.cursos = cursos; estado.ramoSel = null;
        normalizarCursos(); guardar(); pintarMalla(); pintarPanel();
        aviso(L("Malla importada: ", "Plan imported: ", "规划已导入：") + estado.cursos.length + L(" ramos.", " courses.", " 门课程。"));
      } catch (e) { aviso(L("No se pudo leer la malla.", "The plan could not be read.", "无法读取规划。")); }
    };
    lector.readAsText(file);
  }
  function exportarMalla() {
    normalizarCursos();
    var blob = new Blob([JSON.stringify({ v: 1, tipo: "mimo-malla", cursos: estado.cursos }, null, 2)],
      { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "mimo-malla.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    aviso(L("Malla exportada.", "Plan exported.", "规划已导出。"));
  }

  /* ---- U4b: Calificaciones, notas por categoría, examen y eximición ---- */
  var califSel = null;

  function califPorDefecto() {
    return {
      categorias: [{ nombre: "General", peso: 100 }],
      componentes: [],
      examen: { activo: true, peso: 40, nota: null, reemplaza: null },
      eximicion: { activa: false, modo: "todas", condiciones: [] },
      notaMin: 4, meta: 5
    };
  }
  function notaNum(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(String(v).replace(",", "."));
    if (!isFinite(n)) return null;
    while (n >= 10) n = n / 10;
    if (n > 7) n = 7;
    if (n < 1) n = 1;
    return Math.round(n * 10) / 10;
  }
  function fmtNota(v) { return v === null || v === undefined ? "—" : (Math.round(v * 10) / 10).toFixed(1); }

  /* ---- Puente desde un respaldo de Mimo Academics (formato 2, estado.v3) ----
     El respaldo viejo no se puede cargar tal cual: su capa `estado` guarda semestres,
     cursos, notas, tareas y sesiones con otra forma. Esto lo traduce al estado de MIMO
     universal sin inventar datos: lo que no viene queda vacío. */
  function nivelDeCodigo(cod, tipo) {
    if (String(tipo || "") === "cupo" || /^CUPO/i.test(String(cod || ""))) return 99;
    var m = String(cod || "").match(/(\d)/);
    var n = m ? parseInt(m[1], 10) : 1;
    return n >= 1 && n <= 9 ? n : 1;
  }
  function temaValido(id, alterno) {
    return TEMAS.some(function (t) { return t[0] === id; }) ? id : alterno;
  }
  function convertirAcademics(x) {
    var e = x && x.estado;
    if (!e || typeof e !== "object") return null;
    var n = porDefecto();
    var activo = String(e.activo || "");
    var sem = (e.sem && e.sem[activo]) || {};
    var viejoCurso = {};

    // 1. Periodos: extras + semestres + las claves de e.sem que falten.
    var fuentes = [], vistosSem = {};
    (Array.isArray(e.extras) ? e.extras : []).concat(Array.isArray(x.semestres) ? x.semestres : []).forEach(function (p) {
      if (!p || !p.id || vistosSem[p.id]) return;
      vistosSem[p.id] = 1; fuentes.push(p);
    });
    Object.keys(e.sem || {}).forEach(function (id) {
      if (!vistosSem[id]) { vistosSem[id] = 1; fuentes.push({ id: id, nombre: id, semanas: [] }); }
    });
    n.periodos = fuentes.map(function (p) {
      var semanas = (Array.isArray(p.semanas) ? p.semanas : []).map(function (w, i) {
        return { n: i + 1, desde: String(w.lunes || w.desde || ""), hasta: String(w.domingo || w.hasta || ""), tipo: w.tipo || "clases" };
      });
      return { id: String(p.id), nombre: String(p.nombre || p.id), inicio: String(p.inicio || (semanas[0] && semanas[0].desde) || ""), semanas: semanas };
    });
    n.periodoActivo = n.periodos.some(function (p) { return p.id === activo; }) ? activo : (n.periodos[0] ? n.periodos[0].id : null);

    // 2. Cursos: los del semestre activo y los aprobados de otros semestres.
    var cursos = {}, orden = [];
    function agregarCurso(c, cod) {
      cod = String(cod || (c && c.codigo) || "").trim().toUpperCase();
      if (!cod || cursos[cod]) return;
      if (c) viejoCurso[cod] = c;
      var aprob = !!(e.aprobados && e.aprobados[cod]);
      var enActivo = !!(e.agregados && e.agregados[activo] && (e.agregados[activo] || []).some(function (z) {
        return String(z.codigo || "").toUpperCase() === cod;
      }));
      var tipo = /^CUPO/i.test(cod) ? "cupo" : "";
      cursos[cod] = {
        codigo: cod, nombre: String((c && (c.nombre || c.alias)) || cod),
        creditos: Math.max(0, parseInt(c && c.creditos, 10) || 0),
        nivel: nivelDeCodigo(cod, tipo), requisitos: [], requisitos_o: [], aprobacion: null,
        tipo: tipo, enMalla: true,
        cerrado: aprob, aprobado: aprob, resultado: aprob ? "aprobado" : "",
        notaCierre: null, cerradoEn: "", enCurso: enActivo && !aprob
      };
      orden.push(cod);
    }
    ((e.agregados && e.agregados[activo]) || []).forEach(function (c) { agregarCurso(c, c && c.codigo); });
    Object.keys(e.aprobados || {}).forEach(function (cod) { if (e.aprobados[cod]) agregarCurso(null, cod); });
    n.cursos = orden.map(function (cod) { return cursos[cod]; });

    // 3. Calificaciones: cats/comps/examen/exim del semestre; si faltan, las del curso.
    var cats = sem.cats || {}, comps = sem.comps || {}, exam = sem.examen || {}, exim = sem.exim || {};
    var metasRamo = sem.metas_ramo || {};
    n.califs = {};
    n.cursos.forEach(function (cur) {
      var cod = cur.codigo, viejo = viejoCurso[cod] || {};
      var q = califPorDefecto();
      var listaCat = cats[cod] || viejo.categorias || [];
      var listaComp = comps[cod] || viejo.componentes || [];
      var ex = exam[cod] || viejo.examen || {};
      var exi = exim[cod] || viejo.eximicion || {};
      q.categorias = (Array.isArray(listaCat) ? listaCat : []).map(function (cat) {
        return { nombre: String(cat.nombre || "General"), peso: Math.max(0, Number(cat.peso) || 0) };
      });
      if (!q.categorias.length) q.categorias = [{ nombre: "General", peso: 100 }];
      q.componentes = (Array.isArray(listaComp) ? listaComp : []).map(function (c, i) {
        return {
          nombre: String(c.nombre || ("Componente " + (i + 1))),
          categoria: String(c.categoria || q.categorias[0].nombre),
          nota: notaNum(c.nota), fecha: String(c.fecha || ""), peso: Math.max(0.1, Number(c.peso) || 1)
        };
      });
      var pesoEx = Number(ex.peso);
      q.examen = {
        activo: ex.activo !== false,
        peso: isNaN(pesoEx) ? 40 : Math.max(0, Math.min(100, Math.round(pesoEx <= 1 ? pesoEx * 100 : pesoEx))),
        nota: notaNum(ex.nota),
        reemplaza: null
      };
      var rep = parseInt(ex.reemplaza, 10);
      if (!isNaN(rep) && rep >= 0 && rep < q.componentes.length) q.examen.reemplaza = rep;
      q.eximicion = {
        activa: !!exi.activa, modo: exi.modo === "alguna" ? "alguna" : "todas",
        condiciones: (Array.isArray(exi.condiciones) ? exi.condiciones : []).map(function (c) {
          return {
            tipo: ["presentacion", "categoria", "componente"].indexOf(c.tipo) !== -1 ? c.tipo : "presentacion",
            ref: String(c.ref || ""), op: [">=", ">", "<=", "<"].indexOf(c.op) !== -1 ? c.op : ">=",
            valor: notaNum(c.valor) || 1
          };
        })
      };
      var metaRamo = metasRamo[cod] && Number(metasRamo[cod].nota);
      q.meta = isFinite(metaRamo) && metaRamo > 0 ? Math.min(7, metaRamo) : 5;
      n.califs[cod] = q;
    });

    // 4. Tareas: las `nuevas` del semestre, con sus hechas y prioridades.
    var hechas = sem.hechas || {}, prios = sem.prioridades || {};
    n.tareas = (Array.isArray(sem.nuevas) ? sem.nuevas : []).map(function (t, i) {
      var vid = String(t.id || "");
      var hecha = !!hechas[vid];
      return {
        id: "ti" + (vid || i), titulo: String(t.texto || "Sin título"), tipo: "tarea",
        padre_id: null, estado: hecha ? "hecha" : "pendiente", hecha: hecha,
        prioridad: prios[vid] || "media", fecha: String(t.fecha || ""),
        contexto: String(t.ramo && t.ramo !== "OTROS" ? t.ramo : ""),
        nota: String(t.detalle || ""), orden: i, creada: ""
      };
    });

    // 5. Sesiones y metas de estudio.
    n.sesiones = (Array.isArray(sem.sesiones) ? sem.sesiones : []).map(function (s, i) {
      return {
        id: String(s.id || ("si" + i)), fecha: String(s.fecha || ""),
        minutos: Math.max(0, Number(s.minutos) || 0), ramo: String(s.ramo || "").toUpperCase(),
        vinculo: "", hora: String(s.hora || ""), tipo: "importado"
      };
    });
    n.estudio = { metaSemanal: Math.max(0, Number((sem.metas || {}).semanal) || 0), metasRamo: {}, metasSemana: {} };
    Object.keys(metasRamo).forEach(function (cod) {
      var v = metasRamo[cod];
      n.estudio.metasRamo[String(cod).toUpperCase()] = Math.max(0, Number(v && (v.horas !== undefined ? v.horas : v)) || 0);
    });

    // 6. Tema, pareja claro/oscuro e idioma.
    var av = (e.ajustes && e.ajustes.av) || {};
    n.tema = temaValido(av.tema, temaValido(av.temaOscuro, "clasico"));
    n.prefs.temaClaro = temaValido(av.temaClaro, "clasico");
    n.prefs.temaOscuro = temaValido(av.temaOscuro, "deepsea");
    var idi = String(e.idioma || (e.ajustes && e.ajustes.idioma) || av.idioma || "es").toLowerCase();
    n.prefs.idioma = (idi === "en" || idi === "zh") ? idi : "es";
    // Un respaldo académico trae datos de Malla, Calificaciones y Estudio: se instalan sus
    // bloques para que se vean al abrir, sin pedirle al usuario que adivine el catálogo.
    n.instalados = ["tiempo", "malla", "calificaciones", "estudio", "evaluaciones"];
    n.kits = { academics: ["malla", "calificaciones", "estudio", "evaluaciones"] };
    return n;
  }

  function fmtNota2(v) { return v === null || v === undefined ? "—" : (Math.round(v * 100) / 100).toFixed(2); }
  function textoNecesario(v) {
    if (v === null || v === undefined) return "—";
    if (v <= 1) return "no hace falta";
    if (v > 7) return "imposible";
    return fmtNota2(v);
  }
  function normalizarCalifs() {
    normalizarCursos();
    if (!estado.califs || typeof estado.califs !== "object") estado.califs = {};
    var vigentes = {};
    estado.cursos.forEach(function (cur) {
      var q = estado.califs[cur.codigo];
      if (!q || typeof q !== "object") q = califPorDefecto();
      if (!Array.isArray(q.categorias) || !q.categorias.length) q.categorias = [{ nombre: "General", peso: 100 }];
      q.categorias = q.categorias.map(function (cat, i) {
        return { nombre: String(cat.nombre || "Categoría " + (i + 1)), peso: Math.max(0, Number(cat.peso) || 0) };
      });
      var vistosCat = {};
      q.categorias.forEach(function (cat) {
        var base = cat.nombre, n = 1;
        while (vistosCat[cat.nombre]) { n++; cat.nombre = base + " " + n; }
        vistosCat[cat.nombre] = 1;
      });
      q.componentes = (Array.isArray(q.componentes) ? q.componentes : []).map(function (x, i) {
        return {
          nombre: String(x.nombre || "Componente " + (i + 1)),
          categoria: String(x.categoria || q.categorias[0].nombre),
          nota: notaNum(x.nota), fecha: String(x.fecha || ""), peso: Math.max(0.1, Number(x.peso) || 1)
        };
      });
      q.componentes.forEach(function (x) {
        if (!q.categorias.some(function (c) { return c.nombre === x.categoria; })) x.categoria = q.categorias[0].nombre;
      });
      var ex = q.examen || {};
      q.examen = {
        activo: ex.activo !== false,
        peso: Math.max(0, Math.min(100, Number(ex.peso))),
        nota: notaNum(ex.nota),
        reemplaza: null
      };
      if (isNaN(q.examen.peso)) q.examen.peso = 40;
      var rep = parseInt(ex.reemplaza, 10);
      if (!isNaN(rep) && rep >= 0 && rep < q.componentes.length) q.examen.reemplaza = rep;
      var exi = q.eximicion || {};
      q.eximicion = { activa: !!exi.activa, modo: exi.modo === "alguna" ? "alguna" : "todas", condiciones: [] };
      (Array.isArray(exi.condiciones) ? exi.condiciones : []).forEach(function (c) {
        var tipo = ["presentacion", "categoria", "componente"].indexOf(c.tipo) !== -1 ? c.tipo : "presentacion";
        var op = [">=", ">", "<=", "<"].indexOf(c.op) !== -1 ? c.op : ">=";
        q.eximicion.condiciones.push({ tipo: tipo, ref: String(c.ref || ""), op: op, valor: notaNum(c.valor) || 1 });
      });
      q.notaMin = notaNum(q.notaMin) || 4;
      q.meta = notaNum(q.meta) || 5;
      estado.califs[cur.codigo] = q; vigentes[cur.codigo] = 1;
    });
    Object.keys(estado.califs).forEach(function (cod) { if (!vigentes[cod]) delete estado.califs[cod]; });
  }
  function califDe(cod) {
    if (!estado.califs || typeof estado.califs !== "object") estado.califs = {};
    if (!estado.califs[cod]) estado.califs[cod] = califPorDefecto();
    return estado.califs[cod];
  }
  function valorComp(c, i) {
    if (!c.componentes[i]) return null;
    var ex = c.examen;
    if (ex && ex.reemplaza === i && ex.nota !== null && ex.nota !== undefined) return Number(ex.nota);
    var n = c.componentes[i].nota;
    return n === null || n === undefined ? null : Number(n);
  }
  function promedioCategoria(c, cat) {
    var sp = 0, sn = 0;
    c.componentes.forEach(function (x, i) {
      if ((x.categoria || "General") !== cat.nombre) return;
      var v = valorComp(c, i); if (v === null) return;
      var p = Number(x.peso) || 1;
      sp += p; sn += p * v;
    });
    return sp ? sn / sp : null;
  }
  function presentacionDe(c) {
    var sp = 0, sn = 0;
    c.categorias.forEach(function (cat) {
      var p = promedioCategoria(c, cat); if (p === null) return;
      var w = Number(cat.peso) || 0;
      sp += w; sn += w * p;
    });
    return sp ? sn / sp : null;
  }
  function condicionValor(c, cond) {
    if (cond.tipo === "presentacion") return presentacionDe(c);
    if (cond.tipo === "categoria") {
      var cat = c.categorias.filter(function (x) { return x.nombre === cond.ref; })[0];
      return cat ? promedioCategoria(c, cat) : null;
    }
    var i = c.componentes.map(function (x) { return x.nombre; }).indexOf(cond.ref);
    return i >= 0 ? valorComp(c, i) : null;
  }
  function estadoEximicion(c) {
    var ex = c.eximicion;
    var detalle = (ex.condiciones || []).map(function (cond) {
      var v = condicionValor(c, cond);
      var ok = false;
      if (v !== null) {
        var x = Number(cond.valor);
        ok = cond.op === ">=" ? v >= x : cond.op === "<=" ? v <= x : cond.op === ">" ? v > x : v < x;
      }
      return { cond: cond, actual: v, ok: ok };
    });
    var cumple = ex.activa && detalle.length > 0 &&
      (ex.modo === "alguna" ? detalle.some(function (d) { return d.ok; }) : detalle.every(function (d) { return d.ok; }));
    return { activa: ex.activa, modo: ex.modo, detalle: detalle, cumple: cumple,
      sinDatos: detalle.some(function (d) { return d.actual === null; }) };
  }
  function notaFinalDe(c) {
    var P = presentacionDe(c); if (P === null) return null;
    if (estadoEximicion(c).cumple) return P;
    if (!c.examen.activo) return P;
    if (c.examen.nota === null || c.examen.nota === undefined) return null;
    return (1 - c.examen.peso / 100) * P + (c.examen.peso / 100) * c.examen.nota;
  }
  function estadoCalifDe(c, curso) {
    if (!curso || !curso.cerrado) return { texto: L("en curso", "in progress", "进行中"), clase: "" };
    return curso.aprobado
      ? { texto: L("aprobado", "passed", "已通过"), clase: "pill-ok" }
      : { texto: L("reprobado", "failed", "未通过"), clase: "pill-bad" };
  }
  function necesarioDe(c, objetivo) {
    if (!c.examen.activo || c.examen.peso <= 0) return null;
    var P = presentacionDe(c); if (P === null) return null;
    var f0 = (1 - c.examen.peso / 100) * P;
    var f1 = f0 + (c.examen.peso / 100);
    if (Math.abs(f1 - f0) < 1e-9) return null;
    return (objetivo - f0) / (f1 - f0);
  }
  function htmlDetalleCalif(cur, q) {
    if (!cur) return '<p class="muted">' + esc(L("Selecciona un ramo.", "Select a course.", "选择一门课程。")) + '</p>';
    var P = presentacionDe(q), nf = notaFinalDe(q), est = estadoCalifDe(q, cur), ex = estadoEximicion(q);
    var necMin = necesarioDe(q, q.notaMin), necMeta = necesarioDe(q, q.meta);
    var filasCat = q.categorias.map(function (cat, i) {
      var p = promedioCategoria(q, cat);
      return '<tr><td><input class="entrada calif-entrada" type="text" data-cat-nombre="' + i + '" value="' + esc(cat.nombre) + '"></td>' +
        '<td class="num"><input class="entrada calif-entrada calif-num" type="number" min="0" max="100" step="5" data-cat-peso="' + i + '" value="' + (Number(cat.peso) || 0) + '"></td>' +
        '<td class="num">' + fmtNota(p) + '</td>' +
        '<td class="num"><button class="calif-x" type="button" data-accion-calif="cat-quitar" data-i="' + i + '" title="' + esc(L("Quitar categoría", "Remove category", "移除分类")) + '" aria-label="' + esc(L("Quitar categoría", "Remove category", "移除分类")) + '">×</button></td></tr>';
    }).join("");
    var opcionesCat = q.categorias.map(function (cat) {
      return '<option value="' + esc(cat.nombre) + '">' + esc(cat.nombre) + "</option>";
    }).join("");
    var filasComp = q.componentes.map(function (comp, i) {
      var reemplaza = q.examen.reemplaza === i;
      var celdaNota = reemplaza
        ? '<span class="muted">' + (q.examen.nota === null ? L("lo pone el examen", "set by the exam", "由考试决定") : fmtNota(q.examen.nota)) + "</span>"
        : '<input class="entrada calif-entrada calif-num" type="number" min="1" max="7" step="0.1" data-comp-nota="' + i + '" value="' + (comp.nota === null ? "" : comp.nota) + '">';
      return '<tr><td><input class="entrada calif-entrada" type="text" data-comp-nombre="' + i + '" value="' + esc(comp.nombre) + '"></td>' +
        '<td><select class="entrada calif-entrada" data-comp-cat="' + i + '">' + q.categorias.map(function (cat) {
          return '<option value="' + esc(cat.nombre) + '"' + (cat.nombre === comp.categoria ? " selected" : "") + ">" + esc(cat.nombre) + "</option>";
        }).join("") + "</select></td>" +
        '<td class="num">' + celdaNota + "</td>" +
        '<td><div class="calif-fecha"><input class="entrada calif-entrada" type="date" data-comp-fecha="' + i + '" value="' + esc(comp.fecha) + '"><button class="btn btn--chico" type="button" data-accion-calif="comp-cal" data-i="' + i + '" title="' + esc(L("Pasar al calendario", "Send to calendar", "发送到日历")) + '" aria-label="' + esc(L("Pasar al calendario", "Send to calendar", "发送到日历")) + '">Cal</button></div></td>' +
        '<td class="num"><button class="calif-x" type="button" data-accion-calif="comp-quitar" data-i="' + i + '" title="' + esc(L("Quitar componente", "Remove component", "移除评分项")) + '" aria-label="' + esc(L("Quitar componente", "Remove component", "移除评分项")) + '">×</button></td></tr>';
    }).join("");
    var opcionesComp = q.componentes.map(function (comp, i) {
      return '<option value="' + i + '"' + (q.examen.reemplaza === i ? " selected" : "") + ">" + esc(comp.nombre) + "</option>";
    }).join("");
    var filasCond = q.eximicion.condiciones.map(function (cond, i) {
      var ref = "";
      if (cond.tipo === "presentacion") ref = '<span class="muted calif-ref">' + esc(L("la presentación", "the presentation grade", "平时成绩")) + '</span>';
      else if (cond.tipo === "categoria") {
        ref = '<select class="entrada calif-entrada" data-cond-ref="' + i + '">' + q.categorias.map(function (cat) {
          return '<option value="' + esc(cat.nombre) + '"' + (cat.nombre === cond.ref ? " selected" : "") + ">" + esc(cat.nombre) + "</option>";
        }).join("") + "</select>";
      } else {
        ref = '<select class="entrada calif-entrada" data-cond-ref="' + i + '">' + q.componentes.map(function (comp) {
          return '<option value="' + esc(comp.nombre) + '"' + (comp.nombre === cond.ref ? " selected" : "") + ">" + esc(comp.nombre) + "</option>";
        }).join("") + "</select>";
      }
      return '<div class="calif-cond">' +
        '<select class="entrada calif-entrada" data-cond-tipo="' + i + '">' +
          '<option value="presentacion"' + (cond.tipo === "presentacion" ? " selected" : "") + ">" + esc(L("Presentación", "Presentation", "平时成绩")) + "</option>" +
          '<option value="categoria"' + (cond.tipo === "categoria" ? " selected" : "") + ">" + esc(L("Categoría", "Category", "分类")) + "</option>" +
          '<option value="componente"' + (cond.tipo === "componente" ? " selected" : "") + ">" + esc(L("Componente", "Component", "评分项")) + "</option></select>" +
        ref +
        '<select class="entrada calif-entrada calif-op" data-cond-op="' + i + '">' +
          ["<", "<=", ">=", ">"].map(function (op) { return '<option' + (cond.op === op ? " selected" : "") + ">" + op + "</option>"; }).join("") +
        "</select>" +
        '<input class="entrada calif-entrada calif-num" type="number" min="1" max="7" step="0.1" data-cond-valor="' + i + '" value="' + cond.valor + '">' +
        '<button class="calif-x" type="button" data-accion-calif="cond-quitar" data-i="' + i + '" title="' + esc(L("Quitar condición", "Remove condition", "移除条件")) + '" aria-label="' + esc(L("Quitar condición", "Remove condition", "移除条件")) + '">×</button></div>';
    }).join("");
    var textoExim = !q.eximicion.activa ? L("La eximición está desactivada para este ramo.", "Exemption is off for this course.", "本课程未启用免考。") :
      !q.eximicion.condiciones.length ? L("Sin condiciones: con ninguna, el ramo no se exime.", "No conditions: without any, the course is not exempted.", "没有条件：没有条件时课程不能免考。") :
      ex.sinDatos ? L("Faltan notas para saber si te eximes.", "Grades are missing to know whether you are exempt.", "缺少成绩，无法判断是否免考。") :
      ex.cumple ? L("Con estas notas, ya te eximes.", "With these grades, you are already exempt.", "按这些成绩，你已免考。") : L("Con estas notas, todavía no te eximes.", "With these grades, you are not exempt yet.", "按这些成绩，你还未免考。");
    var claseFinal = cur.cerrado ? (cur.aprobado ? "ok" : "bad") : "warn";
    var cierre = cur.cerrado
      ? '<div class="calif-cierre calif-cierre--' + (cur.aprobado ? "ok" : "bad") + '"><div><b>Curso cerrado · ' +
        esc(cur.aprobado ? L("APROBADO", "PASSED", "已通过") : L("REPROBADO", "FAILED", "未通过")) + "</b><span>" + esc(L("Final ", "Final ", "最终 ")) +
        fmtNota(cur.notaCierre !== null ? cur.notaCierre : nf) + (cur.cerradoEn ? " · " + esc(cur.cerradoEn) : "") +
        '</span></div><button class="btn btn--chico" type="button" data-accion-calif="reabrir-curso">' + esc(L("Reabrir curso", "Reopen course", "重新打开课程")) + '</button></div>'
      : '<div class="calif-cierre"><div><b>' + esc(L("Curso abierto", "Course open", "课程开放")) + '</b><span>' + esc(L("La final es provisional. Al cerrar, el resultado se fija con las notas, el examen y la eximición.", "The final grade is provisional. When you close it, the result is fixed with the grades, the exam and the exemption.", "最终成绩为暂定。关闭时，结果将由成绩、考试和免考共同确定。")) + '</span></div><button class="btn btn-primario btn--chico" type="button" data-accion-calif="cerrar-curso">' + esc(L("Cerrar curso", "Close course", "关闭课程")) + '</button></div>';
    return '<div class="card calif-card">' +
      '<div class="calif-cab"><div><h2>' + esc(cur.codigo) + " — " + esc(cur.nombre) + "</h2>" +
        '<p class="muted">' + creditosDe(cur) + " " + esc(L("créditos", "credits", "学分")) + " · " + esc(etiquetaNivel(cur.nivel)) + " · " + esc(L("meta ", "goal ", "目标 ")) + fmtNota(q.meta) + "</p></div>" +
        '<span class="pill ' + est.clase + '">' + esc(est.texto) + "</span></div>" +
      '<div class="calif-resumen">' +
        '<div class="calif-caja calif-caja--ac"><b>' + fmtNota(P) + "</b><span>" + esc(L("Presentación", "Presentation", "平时成绩")) + "</span></div>" +
        '<div class="calif-caja calif-caja--' + claseFinal + '"><b>' + fmtNota(nf) + "</b><span>" + (cur.cerrado ? L("Final", "Final", "最终") : L("Final provisional", "Provisional final", "暂定最终")) + "</span></div>" +
        '<div class="calif-caja calif-caja--est"><b>' + esc(est.texto) + "</b><span>" + esc(L("Estado", "Status", "状态")) + "</span></div>" +
        '<div class="calif-caja calif-caja--warn"><b>' + (ex.cumple ? L("eximido", "exempt", "免考") : q.examen.activo ? textoNecesario(necMin) : L("sin examen", "no exam", "无考试")) + "</b><span>" + esc(L("Examen para ", "Exam for ", "考试目标 ")) + fmtNota(q.notaMin) + "</span></div>" +
      "</div>" + cierre +
      '<div class="calif-ajustes">' +
        '<label class="campo">' + esc(L("Nota mínima", "Minimum grade", "最低成绩")) + ' <input class="entrada calif-num" type="number" min="1" max="7" step="0.1" data-nota-min value="' + q.notaMin + '"></label>' +
        '<label class="campo">' + esc(L("Meta", "Goal", "目标")) + ' <input class="entrada calif-num" type="number" min="1" max="7" step="0.1" data-meta value="' + q.meta + '"></label>' +
        '<span class="muted">' + esc(L("Examen para la meta: ", "Exam for the goal: ", "达成目标的考试：")) + (q.examen.activo ? textoNecesario(necMeta) : L("sin examen", "no exam", "无考试")) + "</span>" +
      "</div>" +
      '<section class="calif-bloque"><h3>' + esc(L("Categorías", "Categories", "分类")) + ' <span>' + esc(L("peso sobre la presentación", "weight over the presentation grade", "占平时成绩比重")) + '</span></h3>' +
        '<div class="calif-tabla-wrap"><table class="calif-tabla"><thead><tr><th>' + esc(L("Categoría", "Category", "分类")) + '</th><th class="num">' + esc(L("Peso %", "Weight %", "权重 %")) + '</th><th class="num">' + esc(L("Promedio", "Average", "平均")) + '</th><th></th></tr></thead><tbody>' +
        (filasCat || '<tr><td colspan="4" class="muted">' + esc(L("Sin categorías.", "No categories.", "没有分类。")) + '</td></tr>') + "</tbody></table></div>" +
        '<button class="btn btn--chico" type="button" data-accion-calif="cat-add">' + esc(L("+ Categoría", "+ Category", "+ 分类")) + '</button></section>' +
      '<section class="calif-bloque"><h3>' + esc(L("Componentes y notas", "Components and grades", "评分项与成绩")) + '</h3>' +
        '<div class="calif-tabla-wrap"><table class="calif-tabla"><thead><tr><th>' + esc(L("Componente", "Component", "评分项")) + '</th><th>' + esc(L("Categoría", "Category", "分类")) + '</th><th class="num">' + esc(L("Nota", "Grade", "成绩")) + '</th><th>' + esc(L("Fecha", "Date", "日期")) + '</th><th></th></tr></thead><tbody>' +
        (filasComp || '<tr><td colspan="5" class="muted">' + esc(L("Sin componentes todavía.", "No components yet.", "还没有评分项。")) + '</td></tr>') + "</tbody></table></div>" +
        '<button class="btn btn--chico" type="button" data-accion-calif="comp-add">' + esc(L("+ Componente", "+ Component", "+ 评分项")) + '</button></section>' +
      '<section class="calif-bloque"><h3>' + esc(L("Examen", "Exam", "考试")) + '</h3><div class="calif-examen">' +
        '<label class="check"><input type="checkbox" data-exam-activo' + (q.examen.activo ? " checked" : "") + "> " + esc(L("Activo", "Active", "启用")) + "</label>" +
        '<label class="campo">' + esc(L("Peso %", "Weight %", "权重 %")) + ' <input class="entrada calif-num" type="number" min="0" max="100" step="5" data-exam-peso value="' + q.examen.peso + '"></label>' +
        '<label class="campo">' + esc(L("Nota", "Grade", "成绩")) + ' <input class="entrada calif-num" type="number" min="1" max="7" step="0.1" data-exam-nota value="' + (q.examen.nota === null ? "" : q.examen.nota) + '"></label>' +
        '<label class="campo">' + esc(L("Reemplaza", "Replaces", "替代")) + ' <select class="entrada calif-entrada" data-exam-reemplaza><option value="">—</option>' + opcionesComp + "</select></label>" +
      "</div></section>" +
      '<section class="calif-bloque"><h3>' + esc(L("Eximición", "Exemption", "免考")) + '</h3>' +
        '<label class="check"><input type="checkbox" data-exim-activa' + (q.eximicion.activa ? " checked" : "") + "> " + esc(L("El ramo se puede eximir", "The course can be exempted", "课程可以免考")) + "</label>" +
        '<label class="campo">' + esc(L("Deben cumplirse", "Must meet", "须满足")) + ' <select class="entrada" data-exim-modo>' +
          '<option value="todas"' + (q.eximicion.modo === "todas" ? " selected" : "") + ">" + esc(L("Todas", "All", "全部")) + "</option>" +
          '<option value="alguna"' + (q.eximicion.modo === "alguna" ? " selected" : "") + ">" + esc(L("Al menos una", "At least one", "至少一项")) + "</option></select></label>" +
        (filasCond || '<p class="muted">' + esc(L("Sin condiciones: mientras no haya ninguna, el ramo no se exime.", "No conditions: while there are none, the course is not exempted.", "没有条件：在添加条件前，课程不能免考。")) + '</p>') +
        '<button class="btn btn--chico" type="button" data-accion-calif="cond-add">' + esc(L("+ Condición", "+ Condition", "+ 条件")) + '</button>' +
        '<p class="calif-exim-estado ' + (ex.cumple ? "ok" : "") + '">' + esc(textoExim) + "</p></section>" +
      "</div>";
  }
  function pintarCalificaciones() {
    var lista = $("#calif-lista"), det = $("#calif-detalle");
    if (!lista || !det) return;
    normalizarCursos(); normalizarCalifs();
    var cursos = estado.cursos, vacio = $("#calif-vacio"), layout = $("#calif-layout");
    if (!cursos.length) {
      if (vacio) vacio.hidden = false;
      if (layout) layout.hidden = true;
      return;
    }
    if (vacio) vacio.hidden = true;
    if (layout) layout.hidden = false;
    if (!califSel || !ramoPorCodigo(califSel)) califSel = estado.califSel && ramoPorCodigo(estado.califSel) ? estado.califSel : cursos[0].codigo;
    estado.califSel = califSel; estado.ramoSel = califSel;
    lista.innerHTML = cursos.slice().sort(function (a, b) { return a.codigo < b.codigo ? -1 : 1; }).map(function (cur) {
      var q = califDe(cur.codigo), est = estadoCalifDe(q, cur);
      return '<button class="calif-item' + (cur.codigo === califSel ? " on" : "") + '" type="button" data-calif="' + esc(cur.codigo) + '">' +
        '<span class="calif-item__nom"><b>' + esc(cur.codigo) + "</b> " + esc(cur.nombre) + "</span>" +
        '<small>' + esc(L("P ", "P ", "平时 ")) + fmtNota(presentacionDe(q)) + " · " + esc(L("Final ", "Final ", "最终 ")) + fmtNota(notaFinalDe(q)) + "</small>" +
        '<em class="pill ' + est.clase + '">' + esc(est.texto) + "</em></button>";
    }).join("");
    det.innerHTML = htmlDetalleCalif(ramoPorCodigo(califSel), califDe(califSel));
  }
  function cambioCalif(e) {
    var el = e.target, q = califDe(califSel); if (!q || !el) return;
    var i = parseInt(el.getAttribute("data-i"), 10);
    if (el.hasAttribute("data-cat-nombre") || el.hasAttribute("data-cat-peso")) {
      var ic = parseInt(el.getAttribute("data-cat-nombre") || el.getAttribute("data-cat-peso"), 10);
      if (!q.categorias[ic]) return;
      if (el.hasAttribute("data-cat-nombre")) {
        var viejo = q.categorias[ic].nombre, nuevo = el.value.trim() || "Categoría";
        q.categorias[ic].nombre = nuevo;
        q.componentes.forEach(function (x) { if (x.categoria === viejo) x.categoria = nuevo; });
        q.eximicion.condiciones.forEach(function (c) { if (c.tipo === "categoria" && c.ref === viejo) c.ref = nuevo; });
      } else q.categorias[ic].peso = Math.max(0, Number(el.value) || 0);
    } else if (el.hasAttribute("data-comp-nombre") || el.hasAttribute("data-comp-cat") || el.hasAttribute("data-comp-nota") || el.hasAttribute("data-comp-fecha")) {
      var ix = parseInt(el.getAttribute("data-comp-nombre") || el.getAttribute("data-comp-cat") || el.getAttribute("data-comp-nota") || el.getAttribute("data-comp-fecha"), 10);
      if (!q.componentes[ix]) return;
      if (el.hasAttribute("data-comp-nombre")) q.componentes[ix].nombre = el.value.trim() || "Componente";
      else if (el.hasAttribute("data-comp-cat")) q.componentes[ix].categoria = el.value;
      else if (el.hasAttribute("data-comp-nota")) q.componentes[ix].nota = notaNum(el.value);
      else q.componentes[ix].fecha = el.value;
      sincronizarEventoComp(q, ix, false);
    } else if (el.hasAttribute("data-exam-activo")) q.examen.activo = el.checked;
    else if (el.hasAttribute("data-exam-peso")) q.examen.peso = Math.max(0, Math.min(100, Number(el.value) || 0));
    else if (el.hasAttribute("data-exam-nota")) q.examen.nota = notaNum(el.value);
    else if (el.hasAttribute("data-exam-reemplaza")) q.examen.reemplaza = el.value === "" ? null : parseInt(el.value, 10);
    else if (el.hasAttribute("data-exim-activa")) q.eximicion.activa = el.checked;
    else if (el.hasAttribute("data-exim-modo")) q.eximicion.modo = el.value;
    else if (el.hasAttribute("data-cond-tipo") || el.hasAttribute("data-cond-ref") || el.hasAttribute("data-cond-op") || el.hasAttribute("data-cond-valor")) {
      var icond = parseInt(el.getAttribute("data-cond-tipo") || el.getAttribute("data-cond-ref") || el.getAttribute("data-cond-op") || el.getAttribute("data-cond-valor"), 10);
      var cond = q.eximicion.condiciones[icond]; if (!cond) return;
      if (el.hasAttribute("data-cond-tipo")) { cond.tipo = el.value; cond.ref = ""; }
      else if (el.hasAttribute("data-cond-ref")) cond.ref = el.value;
      else if (el.hasAttribute("data-cond-op")) cond.op = el.value;
      else cond.valor = notaNum(el.value) || 1;
    } else if (el.hasAttribute("data-nota-min")) q.notaMin = notaNum(el.value) || 4;
    else if (el.hasAttribute("data-meta")) q.meta = notaNum(el.value) || 5;
    guardar(); pintarCalificaciones(); pintarPanel();
  }
  function eventoCompId(codigo, i) { return "calif-" + codigo + "-" + i; }
  function sincronizarEventoComp(q, i, crear) {
    var comp = q && q.componentes ? q.componentes[i] : null;
    if (!comp) return;
    var id = eventoCompId(califSel, i), ev = eventoPorId(id);
    if (!comp.fecha) {
      if (ev) estado.eventos = estado.eventos.filter(function (e) { return e.id !== id; });
      return;
    }
    if (!ev && !crear) return;
    if (!ev) { ev = { id: id, hora: "", nota: "" }; estado.eventos.push(ev); }
    ev.titulo = comp.nombre + " · " + califSel;
    ev.fecha = comp.fecha;
    ev.contexto = "Calificaciones";
    ev.nota = comp.categoria || "";
  }
  function accionCalif(e) {
    var b = e.target.closest("[data-accion-calif]"); if (!b) return;
    var q = califDe(califSel); if (!q) return;
    var accion = b.getAttribute("data-accion-calif"), i = parseInt(b.getAttribute("data-i"), 10);
    if (accion === "cerrar-curso") { cerrarCurso(califSel); return; }
    if (accion === "reabrir-curso") { reabrirCurso(califSel); return; }
    if (accion === "comp-cal") {
      var comp = q.componentes[i];
      if (!comp || !comp.fecha) { aviso(L("Ponle una fecha al componente primero.", "Give the component a date first.", "请先给评分项设置日期。")); return; }
      sincronizarEventoComp(q, i, true);
      guardar(); pintarCalificaciones(); pintarCalendario();
      aviso(L("Componente pasado al calendario.", "Component sent to the calendar.", "评分项已发送到日历。"));
      return;
    }
    if (accion === "cat-add") q.categorias.push({ nombre: "Categoría " + (q.categorias.length + 1), peso: 0 });
    else if (accion === "comp-add") q.componentes.push({ nombre: "Componente " + (q.componentes.length + 1), categoria: q.categorias[0].nombre, nota: null, fecha: "", peso: 1 });
    else if (accion === "cond-add") q.eximicion.condiciones.push({ tipo: "presentacion", ref: "", op: ">=", valor: 5 });
    else if (accion === "cat-quitar") {
      if (q.categorias.length <= 1) { aviso(L("Debe quedar al menos una categoría.", "At least one category must remain.", "至少保留一个分类。")); return; }
      if (!window.confirm(L("¿Quitar la categoría \"" + q.categorias[i].nombre + "\"?", "Remove the category \"" + q.categorias[i].nombre + "\"?", "移除分类“" + q.categorias[i].nombre + "”？"))) return;
      var nombre = q.categorias[i].nombre;
      q.categorias.splice(i, 1);
      q.componentes.forEach(function (x) { if (x.categoria === nombre) x.categoria = q.categorias[0].nombre; });
    } else if (accion === "comp-quitar") {
      var evId = eventoCompId(califSel, i);
      estado.eventos = (estado.eventos || []).filter(function (e) { return e.id !== evId; });
      q.componentes.splice(i, 1);
      if (q.examen.reemplaza === i) q.examen.reemplaza = null;
      else if (q.examen.reemplaza > i) q.examen.reemplaza--;
    } else if (accion === "cond-quitar") q.eximicion.condiciones.splice(i, 1);
    guardar(); pintarCalificaciones(); pintarPanel();
  }

  /* ---- U4c: Estudio, horas por ramo y meta semanal ---- */
  var PALETA_ESTUDIO = ["#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0e7490", "#be123c", "#0f766e", "#a16207", "#dc2626"];
  function normalizarEstudio() {
    if (!estado.estudio || typeof estado.estudio !== "object") estado.estudio = { metaSemanal: 10, metasRamo: {}, metasSemana: {} };
    estado.estudio.metaSemanal = Math.max(0, Number(estado.estudio.metaSemanal) || 0);
    if (!estado.estudio.metasRamo || typeof estado.estudio.metasRamo !== "object") estado.estudio.metasRamo = {};
    if (!estado.estudio.metasSemana || typeof estado.estudio.metasSemana !== "object") estado.estudio.metasSemana = {};
    var vistos = {};
    estado.sesiones = (estado.sesiones || []).map(function (s, i) {
      var id = String(s.id || ("s" + i));
      while (vistos[id]) id += "-" + i;
      vistos[id] = 1;
      return {
        id: id, fecha: String(s.fecha || hoyISO()), minutos: Math.max(0, Number(s.minutos) || 0),
        ramo: String(s.ramo || "").trim().toUpperCase(), vinculo: String(s.vinculo || ""),
        hora: String(s.hora || ""), tipo: String(s.tipo || "")
      };
    });
  }
  function colorEstudio(cod) {
    var i = estado.cursos.map(function (c) { return c.codigo; }).indexOf(cod);
    return i < 0 ? "var(--muted)" : PALETA_ESTUDIO[i % PALETA_ESTUDIO.length];
  }
  function fmtHoras(min) {
    min = Number(min) || 0;
    if (min <= 0) return "0 h";
    if (min < 60) return Math.round(min) + " min";
    return (Math.round(min / 6) / 10).toString().replace(".", ",") + " h";
  }
  function fmtDuracion(min) {
    var total = Math.round((Number(min) || 0) * 60);
    var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    if (h) return h + " h " + String(m).padStart(2, "0") + " min" + (s ? " " + String(s).padStart(2, "0") + " s" : "");
    if (m) return m + " min" + (s ? " " + s + " s" : "");
    return s + " s";
  }
  function parseDuracion(txt) {
    var s = String(txt || "").trim().replace(",", ".");
    if (!s) return 0;
    if (s.indexOf(":") !== -1) {
      var p = s.split(":").map(function (x) { return parseInt(x, 10) || 0; });
      if (p.length === 2) return p[0] * 60 + p[1];
      if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
      return 0;
    }
    return Math.max(0, Number(s) || 0);
  }
  function isoDeFecha(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function lunesDe(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  function semanasEstudio() {
    var p = periodoActivoObj();
    if (p && p.semanas && p.semanas.length) {
      return p.semanas.map(function (w) {
        return { etiqueta: "S" + w.n, desde: w.desde, hasta: w.hasta, tipo: w.tipo || "clases" };
      });
    }
    var l = lunesDe(new Date()), out = [];
    for (var i = 7; i >= 0; i--) {
      var a = new Date(l.getTime()); a.setDate(a.getDate() - i * 7);
      var b = new Date(a.getTime()); b.setDate(b.getDate() + 6);
      out.push({ etiqueta: (a.getDate()) + "/" + (a.getMonth() + 1), desde: isoDeFecha(a), hasta: isoDeFecha(b), tipo: "clases" });
    }
    return out;
  }
  function pintarEstudio() {
    if (!$("#est-grafico")) return;
    normalizarCursos(); normalizarEstudio();
    var cursos = estado.cursos;
    var semanas = semanasEstudio();
    var meta = Number(estado.estudio.metaSemanal) || 0;
    if ($("#est-meta")) $("#est-meta").value = meta;
    if ($("#est-fecha") && !$("#est-fecha").value) $("#est-fecha").value = hoyISO();
    var sel = $("#est-ramo");
    if (sel) {
      var val = sel.value;
      sel.innerHTML = '<option value="">' + esc(L("Sin ramo", "No course", "无课程")) + '</option>' + cursos.map(function (c) {
        return '<option value="' + esc(c.codigo) + '">' + esc(c.codigo) + " — " + esc(c.nombre) + "</option>";
      }).join("");
      if (val && (val === "" || ramoPorCodigo(val))) sel.value = val;
    }
    var ses = estado.sesiones || [], totalMin = 0, totalRamo = {}, porSemana = {};
    ses.forEach(function (s) {
      totalMin += s.minutos;
      if (s.ramo) totalRamo[s.ramo] = (totalRamo[s.ramo] || 0) + s.minutos;
    });
    semanas.forEach(function (w) { porSemana[w.desde] = 0; });
    ses.forEach(function (s) {
      semanas.forEach(function (w) {
        if (s.fecha >= w.desde && s.fecha <= w.hasta) porSemana[w.desde] += s.minutos;
      });
    });
    function metaDeSemana(w) {
      var ms = estado.estudio.metasSemana || {};
      return Object.prototype.hasOwnProperty.call(ms, w.desde) ? Math.max(0, Number(ms[w.desde]) || 0) : meta;
    }
    var sobre = semanas.filter(function (w) { return porSemana[w.desde] > metaDeSemana(w) * 60 && metaDeSemana(w) > 0; }).length;
    var conDatos = semanas.filter(function (w) { return porSemana[w.desde] > 0; });
    var prom = conDatos.length ? conDatos.reduce(function (a, w) { return a + porSemana[w.desde]; }, 0) / conDatos.length : 0;
    if ($("#est-k-horas")) $("#est-k-horas").textContent = fmtHoras(totalMin);
    if ($("#est-k-sesiones")) $("#est-k-sesiones").textContent = String(ses.length);
    if ($("#est-k-semanas")) $("#est-k-semanas").textContent = String(sobre);
    if ($("#est-k-promedio")) $("#est-k-promedio").textContent = fmtHoras(prom);
    if ($("#est-periodo")) $("#est-periodo").textContent = periodoActivoObj()
      ? L("Periodo ", "Term ", "学期 ") + periodoActivoObj().nombre + " · " + semanas.length + " " + L("semanas", "weeks", "周")
      : L("Últimas ", "Last ", "最近 ") + semanas.length + " " + L("semanas", "weeks", "周");
    if ($("#est-resumen")) $("#est-resumen").textContent = ses.length
      ? ses.length + " " + L("sesiones", "sessions", "会话") + " · " + fmtHoras(totalMin) + " " + L("registradas", "logged", "已记录") + " · " + L("meta ", "goal ", "目标 ") + fmtHoras(meta * 60) + " " + L("por semana.", "per week.", "每周。")
      : L("Sin sesiones todavía. Registra una o usa el cronómetro de Tiempo.", "No sessions yet. Log one or use the Time stopwatch.", "还没有会话。记录一次，或使用时间的秒表。");
    var max = Math.max(meta * 60, 1);
    semanas.forEach(function (w) { max = Math.max(max, porSemana[w.desde]); });
    max *= 1.15;
    var cols = semanas.map(function (w) {
      var total = porSemana[w.desde], pct = Math.min(100, total / max * 100);
      var segs = Object.keys(totalRamo).length ? "" : "";
      var porCurso = {};
      ses.forEach(function (s) {
        if (s.fecha >= w.desde && s.fecha <= w.hasta) {
          var k = s.ramo || "_";
          porCurso[k] = (porCurso[k] || 0) + s.minutos;
        }
      });
      var barras = Object.keys(porCurso).map(function (k) {
        return '<i style="flex:' + porCurso[k] + ';background:' + colorEstudio(k) + '" title="' +
          esc(k === "_" ? L("Sin ramo", "No course", "无课程") : k) + ": " + fmtHoras(porCurso[k]) + '"></i>';
      }).join("");
      return '<div class="est-col" title="' + esc(w.etiqueta) + " · " + fmtHoras(total) + '">' +
        '<span class="est-total">' + (total ? fmtHoras(total) : "") + "</span>" +
        '<div class="est-pila" style="height:' + pct + '%">' + barras + "</div>" +
        '<span class="est-etq">' + esc(w.etiqueta) + "</span></div>";
    }).join("");
    $("#est-grafico").innerHTML = ses.length || meta
      ? '<div class="est-plot"><div class="est-meta-line" style="bottom:' + Math.min(98, meta * 60 / max * 100) + '%"><span>' + esc(L("meta ", "goal ", "目标 ")) +
        fmtHoras(meta * 60) + '</span></div><div class="est-cols">' + cols + "</div></div>"
      : '<p class="empty">' + esc(L("Sin horas todavía. Registra una sesión para ver el gráfico.", "No hours yet. Log a session to see the chart.", "还没有小时记录。记录一次会话即可查看图表。")) + '</p>';
    var leyenda = cursos.filter(function (c) { return totalRamo[c.codigo]; }).map(function (c) {
      return '<span><i style="background:' + colorEstudio(c.codigo) + '"></i>' + esc(c.codigo) + " " + fmtHoras(totalRamo[c.codigo]) + "</span>";
    });
    if (totalRamo._) leyenda.push('<span><i style="background:var(--muted)"></i>' + esc(L("Sin ramo ", "No course ", "无课程 ")) + fmtHoras(totalRamo._) + "</span>");
    $("#est-leyenda").innerHTML = leyenda.join("");
    if ($("#est-metas-semana")) {
      $("#est-metas-semana").innerHTML = '<span class="muted">' + esc(L("Meta por semana:", "Goal per week:", "每周目标：")) + '</span>' + semanas.map(function (w) {
        var v = metaDeSemana(w);
        return '<label class="est-meta-sem">' + esc(w.etiqueta) + ' <input class="entrada est-num" type="number" min="0" max="40" step="0.5" data-est-meta-semana="' + esc(w.desde) + '" value="' + v + '"> h</label>';
      }).join("");
    }
    var filas = cursos.map(function (c) {
      var h = totalRamo[c.codigo] || 0, m = Number(estado.estudio.metasRamo[c.codigo]) || 0;
      var pct = m ? Math.min(100, Math.round(h / (m * 60 * Math.max(1, semanas.length)) * 100)) : 0;
      return '<tr><td><i class="est-punto" style="background:' + colorEstudio(c.codigo) + '"></i>' + esc(c.codigo) + " — " + esc(c.nombre) + "</td>" +
        '<td class="num">' + fmtHoras(h) + "</td>" +
        '<td class="num"><input class="entrada est-num" type="number" min="0" max="40" step="0.5" data-est-meta-ramo="' + esc(c.codigo) + '" value="' + m + '"> h</td>' +
        '<td><div class="est-barra"><i style="width:' + pct + '%"></i></div><small>' + (m ? pct + " % " + L("de ", "of ", "共 ") + (m * semanas.length) + " h" : L("sin meta", "no goal", "无目标")) + "</small></td></tr>";
    }).join("");
    if (totalRamo._) filas += '<tr><td><i class="est-punto" style="background:var(--muted)"></i>' + esc(L("Sin ramo", "No course", "无课程")) + '</td><td class="num">' +
      fmtHoras(totalRamo._) + '</td><td class="num">—</td><td class="muted">' + esc(L("Asigna un ramo para medirlo", "Assign a course to measure it", "分配课程以便统计")) + '</td></tr>';
    $("#est-tabla").innerHTML = filas || '<tr><td colspan="4" class="muted">' + esc(L("Sin ramos. Crea uno en Malla.", "No courses. Create one in the plan.", "没有课程。请在课程规划中创建。")) + '</td></tr>';
    var recientes = ses.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) { return a.s.fecha < b.s.fecha ? 1 : -1; }).slice(0, 12);
    $("#est-sesiones").innerHTML = recientes.length ? recientes.map(function (x) {
      var c = x.s.ramo ? ramoPorCodigo(x.s.ramo) : null;
      return '<div class="est-sesion" data-sesion="' + esc(x.s.id) + '" title="' + esc(L("Clic derecho: editar o borrar", "Right-click: edit or delete", "右键：编辑或删除")) + '"><span><b>' + esc(c ? c.codigo : L("Sin ramo", "No course", "无课程")) + "</b> " + esc(c ? c.nombre : "") +
        "</span><small>" + esc(x.s.fecha) + " · " + esc(fmtDuracion(x.s.minutos)) + '</small>' +
        '<button class="calif-x" type="button" data-editar-estudio="' + esc(x.s.id) + '" title="' + esc(L("Editar sesión", "Edit session", "编辑会话")) + '" aria-label="' + esc(L("Editar sesión", "Edit session", "编辑会话")) + '">✎</button>' +
        '<button class="calif-x" type="button" data-borrar-estudio="' + esc(x.s.id) + '" title="' + esc(L("Borrar sesión", "Delete session", "删除会话")) + '" aria-label="' + esc(L("Borrar sesión", "Delete session", "删除会话")) + '">×</button></div>';
    }).join("") : '<p class="muted">' + esc(L("Sin sesiones todavía.", "No sessions yet.", "还没有会话。")) + '</p>';
    if (pantalla === "estudio") pintarPanel();
  }
  function normalizarNotas() {
    estado.notas = (estado.notas || []).map(function (n, i) {
      return {
        id: n.id || "n" + i,
        titulo: n.titulo || "Sin título",
        cuerpo: n.cuerpo || "",
        contexto: n.contexto || "",
        etiquetas: Array.isArray(n.etiquetas) ? n.etiquetas : (n.tags || []),
        enlaces: Array.isArray(n.enlaces) ? n.enlaces : [],
        fijada: !!n.fijada,
        actualizado: n.actualizado || ""
      };
    });
  }
  function notaActual() {
    return estado.notas.filter(function (n) { return n.id === estado.notaSel; })[0] || null;
  }
  function marcaInline(txt) {
    var s = esc(txt);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function renderMathHTML(html) {
    if (typeof window.renderMathInElement !== "function") return html;
    var cont = document.createElement("div");
    cont.innerHTML = html;
    try {
      window.renderMathInElement(cont, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false,
        errorColor: "#b91c1c",
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      });
    } catch (e) { /* si KaTeX falla, la nota sigue en texto plano */ }
    return cont.innerHTML;
  }
  function renderMarkdown(txt) {
    var guardados = [];
    var fuente = String(txt || "").replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/g, function (m) {
      guardados.push(m);
      return "@@MATH" + (guardados.length - 1) + "@@";
    });
    var lineas = fuente.split("\n"), out = [], lista = false;
    function cerrar() { if (lista) { out.push("</ul>"); lista = false; } }
    lineas.forEach(function (l) {
      var t = l.trim();
      if (!t) { cerrar(); return; }
      if (/^###\s+/.test(t)) { cerrar(); out.push("<h3>" + marcaInline(t.slice(4)) + "</h3>"); return; }
      if (/^##\s+/.test(t)) { cerrar(); out.push("<h2>" + marcaInline(t.slice(3)) + "</h2>"); return; }
      if (/^#\s+/.test(t)) { cerrar(); out.push("<h1>" + marcaInline(t.slice(2)) + "</h1>"); return; }
      if (/^[-*]\s+\[[ xX]\]\s+/.test(t)) {
        if (!lista) { out.push("<ul>"); lista = true; }
        var m = t.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        out.push('<li class="check-item"><input type="checkbox" disabled ' + (m[1].toLowerCase() === "x" ? "checked" : "") + "> " + marcaInline(m[2]) + "</li>");
        return;
      }
      if (/^[-*]\s+/.test(t)) {
        if (!lista) { out.push("<ul>"); lista = true; }
        out.push("<li>" + marcaInline(t.slice(2)) + "</li>");
        return;
      }
      cerrar();
      out.push("<p>" + marcaInline(t) + "</p>");
    });
    cerrar();
    var html = out.join("").replace(/@@MATH(\d+)@@/g, function (_, i) {
      return esc(guardados[parseInt(i, 10)] || "");
    });
    return renderMathHTML(html);
  }
  function pintarNotasLista(destino, conClick) {
    var cont = $(destino);
    if (!cont) return;
    var q = notaBusqueda.toLowerCase();
    var vis = estado.notas.filter(function (n) {
      return !q || (n.titulo + " " + n.cuerpo + " " + n.contexto + " " + n.etiquetas.join(" ")).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0); });
    cont.innerHTML = vis.map(function (n) {
      return '<button class="nota-item' + (n.id === estado.notaSel ? " on" : "") + '" type="button" data-nota="' + n.id + '" title="' + esc(t("cal.clicDerecho")) + '"><b>' +
        (n.fijada ? "★ " : "") + esc(!n.titulo || n.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : n.titulo) + "</b><small>" +
        esc((n.cuerpo || "").slice(0, 70) || L("Vacía", "Empty", "空白")) + (n.contexto ? " · " + esc(n.contexto) : "") + "</small></button>";
    }).join("");
    if (conClick) {
      $$(destino + " [data-nota]").forEach(function (b) {
        b.addEventListener("click", function () {
          var ctx = ctxDe(b);
          estado.notaSel = b.getAttribute("data-nota");
          estado.panel[ctx] = "detalle";
          guardar(); pintarNotas(); pintarPanelDe(ctx);
        });
      });
    }
  }
  function notaVinculoActual(n) {
    return n && n.enlaces && n.enlaces[0] ? n.enlaces[0].tipo + ":" + n.enlaces[0].id : "";
  }
  function pintarNotas() {
    normalizarNotas();
    pintarNotasLista("#notas-items", true);
    pintarNotasLista("#notas-lista-b", true);
    $("#notas-vacio").hidden = estado.notas.length > 0;
    var n = notaActual();
    $("#nota-titulo").disabled = !n;
    $("#nota-cuerpo").disabled = !n;
    $("#nota-contexto").disabled = !n;
    $("#nota-etiquetas").disabled = !n;
    $("#nota-vinculo").disabled = !n;
    $("#nota-modo").disabled = !n;
    $("#nota-fijar").disabled = !n;
    $("#btn-borrar-nota").disabled = !n;
    $("#nota-titulo").value = n ? n.titulo : "";
    $("#nota-cuerpo").value = n ? n.cuerpo : "";
    $("#nota-contexto").value = n ? n.contexto : "";
    $("#nota-etiquetas").value = n ? n.etiquetas.join(", ") : "";
    $("#nota-fijar").textContent = n && n.fijada ? L("Fijada", "Pinned", "已置顶") : L("Fijar", "Pin", "置顶");
    $("#nota-fijar").setAttribute("aria-pressed", n && n.fijada ? "true" : "false");
    var sel = $("#nota-vinculo");
    var ops = ['<option value="">' + esc(L("Enlazar a…", "Link to…", "链接到…")) + '</option>'];
    estado.tareas.forEach(function (t) { ops.push('<option value="tarea:' + t.id + '">' + esc(L("Tarea", "Task", "任务")) + " · " + esc(t.titulo) + "</option>"); });
    estado.eventos.forEach(function (e) { ops.push('<option value="evento:' + e.id + '">' + esc(L("Evento", "Event", "事件")) + " · " + esc(e.titulo) + "</option>"); });
    sel.innerHTML = ops.join("");
    sel.value = n ? notaVinculoActual(n) : "";
    $("#nota-modo").textContent = notaModo === "preview" ? L("Editar", "Edit", "编辑") : L("Vista previa", "Preview", "预览");
    $("#nota-cuerpo").hidden = notaModo === "preview";
    $("#nota-preview").hidden = notaModo !== "preview";
    $("#nota-preview").innerHTML = notaModo === "preview" && n ? renderMarkdown(n.cuerpo) : "";
    $("#nota-meta").textContent = n ? L("Guardada en este equipo · ", "Saved on this device · ", "已保存到本设备 · ") + n.actualizado : L("Sin nota abierta.", "No note open.", "没有打开的笔记。");
  }

  function nombreModo(id) {
    var n = { crono: ["Cronómetro", "Stopwatch", "秒表"], temporizador: ["Temporizador", "Timer", "计时器"],
      pomodoro: ["Pomodoro", "Pomodoro", "番茄钟"], alarmas: ["Alarmas", "Alarms", "闹钟"] }[id];
    return n ? L(n[0], n[1], n[2]) : id;
  }
  function duracionPomo() {
    var p = estado.pomo || {};
    var v = p[estado.pomo.fase] !== undefined ? p[estado.pomo.fase] : p.trabajo;
    return Math.max(0.1, Number(v) || 25);
  }
  function pintaReloj() {
    var modo = estado.tiempoModo || "crono";
    var reloj = $("#reloj");
    if (!reloj) return;
    if (modo === "alarmas") {
      var d = new Date();
      reloj.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (x) { return String(x).padStart(2, "0"); }).join(":");
      return;
    }
    var seg = modo === "crono" ? tiempoSeg : modo === "temporizador" ? tempSeg : pomoSeg;
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = Math.floor(seg % 60);
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("rlj")) return;
    reloj.innerHTML = [["h", h], ["m", m], ["s", s]].map(function (p) {
      return '<input class="rlj" type="text" inputmode="numeric" maxlength="2" data-parte="' + p[0] +
        '" value="' + String(p[1]).padStart(2, "0") + '" aria-label="' + (p[0] === "h" ? L("Horas", "Hours", "小时") : p[0] === "m" ? L("Minutos", "Minutes", "分钟") : L("Segundos", "Seconds", "秒")) + '">';
    }).join(":");
    reloj.classList.toggle("corriendo", !!tiempoInt);
    $$("#reloj .rlj").forEach(function (inp) {
      inp.addEventListener("change", ajustarRelojDesdeInputs);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
      inp.addEventListener("focus", function () { inp.select(); });
    });
  }
  function ajustarRelojDesdeInputs() {
    var vals = $$("#reloj .rlj").map(function (inp) {
      var n = parseInt(inp.value, 10);
      if (isNaN(n) || n < 0) n = 0;
      var max = inp.getAttribute("data-parte") === "h" ? 99 : 59;
      return Math.min(max, n);
    });
    var seg = vals[0] * 3600 + vals[1] * 60 + vals[2];
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    if (estado.tiempoModo === "crono") tiempoSeg = seg;
    else if (estado.tiempoModo === "temporizador") { tempSeg = seg; tempInicial = seg; }
    else if (estado.tiempoModo === "pomodoro") { pomoSeg = seg; pomoInicial = seg; }
    $$("#reloj .rlj").forEach(function (inp, i) { inp.value = String(vals[i]).padStart(2, "0"); });
    $("#reloj").classList.remove("corriendo");
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas";
    $("#btn-pausar").disabled = true;
    $("#btn-parar").disabled = true;
    guardar(); pintarEstadoTiempo();
    aviso(L("Reloj ajustado a ", "Clock set to ", "时钟已设为 ") + [vals[0], vals[1], vals[2]].map(function (x) { return String(x).padStart(2, "0"); }).join(":") + ".");
  }
  function pintarEstadoTiempo() {
    var modo = estado.tiempoModo || "crono", txt;
    if (modo === "alarmas") {
      var act = (estado.alarmas || []).filter(function (a) { return a.activa; }).length;
      txt = L("Alarmas", "Alarms", "闹钟") + " · " + act + " " + L(act === 1 ? "activa" : "activas", "active", "启用");
    } else if (modo === "pomodoro") {
      var fase = estado.pomo.fase === "trabajo" ? L("trabajo", "work", "工作") : estado.pomo.fase === "corto" ? L("pausa corta", "short break", "短休息") : L("pausa larga", "long break", "长休息");
      txt = L("Pomodoro", "Pomodoro", "番茄钟") + " · " + fase + (tiempoInt ? L(" · corriendo", " · running", " · 运行中") : L(" · parado", " · stopped", " · 已停止"));
    } else {
      txt = nombreModo(modo) + (tiempoInt ? L(" · corriendo", " · running", " · 运行中") : modo === "temporizador" && tempSeg ? L(" · listo", " · ready", " · 就绪") : L(" · parado", " · stopped", " · 已停止"));
    }
    if (estado.tiempoRamo && modo !== "alarmas") txt += " · " + estado.tiempoRamo;
    if (estado.tiempoVinculo && modo !== "alarmas") txt += " · " + L("tarea", "task", "任务");
    $("#tiempo-estado").textContent = txt;
  }
  function pintarTiempo() {
    var c = $("#estanteria-tiempo");
    if (!c) return;
    if (estado.tiempoHijos.indexOf(estado.tiempoModo) === -1) estado.tiempoModo = estado.tiempoHijos[0] || "crono";
    var html = estado.tiempoHijos.map(function (id) {
      return '<button class="estante' + (id === estado.tiempoModo ? " on" : "") + '" type="button" data-hijo="' + id + '"><span>' +
        esc(nombreModo(id)) + '</span><span class="quitar" data-quitar-hijo="' + id + '" role="button" tabindex="0" title="' + esc(L("Quitar de Tiempo", "Remove from Time", "从时间中移除")) + '">×</span></button>';
    }).join("");
    html += '<button class="estante estante-add" type="button" id="btn-add-hijo">+</button>';
    html += '<button class="btn" type="button" id="btn-editar-tiempo">' + esc(L("Editar", "Edit", "编辑")) + '</button>';
    c.innerHTML = html;
    $$("#estanteria-tiempo [data-hijo]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        if (ev.target.getAttribute("data-quitar-hijo")) return;
        cambiarModoTiempo(b.getAttribute("data-hijo"));
      });
    });
    $$("#estanteria-tiempo [data-quitar-hijo]").forEach(function (x) {
      x.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var id = x.getAttribute("data-quitar-hijo");
        estado.tiempoHijos = estado.tiempoHijos.filter(function (h) { return h !== id; });
        if (estado.tiempoModo === id) cambiarModoTiempo(estado.tiempoHijos[0] || "crono");
        else { guardar(); pintarTiempo(); }
        aviso(L("Bloque quitado de Tiempo. El padre y sus datos siguen.", "Block removed from Time. The parent and its data remain.", "已从时间中移除模块。父级和数据仍然保留。"));
      });
    });
    $("#btn-editar-tiempo").addEventListener("click", function () {
      document.body.classList.toggle("edit-tiempo");
      aviso(document.body.classList.contains("edit-tiempo") ? L("Editar Tiempo: quita un bloque con ×.", "Edit Time: remove a block with ×.", "编辑时间：用 × 移除模块。") : L("Edición cerrada.", "Editing closed.", "编辑已关闭。"));
    });
    $("#btn-add-hijo").addEventListener("click", function () {
      var falta = HIJOS.filter(function (h) { return estado.tiempoHijos.indexOf(h[0]) === -1; })[0];
      if (!falta) { aviso(L("Los 4 bloques de Tiempo ya están dentro.", "All 4 Time blocks are already inside.", "4 个时间模块都已在内。")); return; }
      estado.tiempoHijos.push(falta[0]); guardar(); pintarTiempo(); aviso(nombreModo(falta[0]) + L(" agregado a Tiempo.", " added to Time.", " 已添加到时间。"));
    });
    var cfg = $("#tiempo-config");
    if (cfg) cfg.innerHTML = "";
    if (estado.tiempoModo === "temporizador" && !tiempoInt && tempSeg === 0) tempSeg = Math.round(Math.max(0.1, Number(estado.tempMin) || 25) * 60);
    if (estado.tiempoModo === "pomodoro" && !tiempoInt && pomoSeg === 0) pomoSeg = Math.round(duracionPomo() * 60);
    if (cfg && estado.tiempoModo === "temporizador") {
      cfg.innerHTML = '<div class="tiempo-config-fila"><label class="campo">' + esc(L("Minutos", "Minutes", "分钟")) + ' <input class="entrada tiempo-num" id="temp-min" type="number" min="0.1" max="180" step="0.1" value="' +
        (Number(estado.tempMin) || 25) + '"></label><span class="muted">' + esc(L("Cuenta atrás; al llegar a cero registra la sesión.", "Countdown; at zero it logs the session.", "倒计时；归零时记录会话。")) + '</span></div>';
      $("#temp-min").addEventListener("change", function (e) {
        estado.tempMin = Math.max(0.1, Number(e.target.value) || 25);
        if (!tiempoInt) { tempSeg = Math.round(estado.tempMin * 60); tempInicial = tempSeg; pintaReloj(); }
        guardar(); pintarEstadoTiempo();
      });
    } else if (cfg && estado.tiempoModo === "pomodoro") {
      cfg.innerHTML = '<div class="tiempo-config-fila"><label class="campo">' + esc(L("Trabajo", "Work", "工作")) + ' <input class="entrada tiempo-num" id="pomo-trabajo" type="number" min="0.1" max="180" step="0.1" value="' + estado.pomo.trabajo + '"></label>' +
        '<label class="campo">' + esc(L("Corto", "Short", "短")) + ' <input class="entrada tiempo-num" id="pomo-corto" type="number" min="0.1" max="60" step="0.1" value="' + estado.pomo.corto + '"></label>' +
        '<label class="campo">' + esc(L("Largo", "Long", "长")) + ' <input class="entrada tiempo-num" id="pomo-largo" type="number" min="0.1" max="120" step="0.1" value="' + estado.pomo.largo + '"></label>' +
        '<label class="campo">' + esc(L("Cada", "Every", "每")) + ' <input class="entrada tiempo-num" id="pomo-cada" type="number" min="1" max="12" step="1" value="' + estado.pomo.cada + '"></label></div>' +
        '<p class="muted">' + esc(L("Fase actual: ", "Current phase: ", "当前阶段：")) + "<b>" + esc(estado.pomo.fase === "trabajo" ? L("trabajo", "work", "工作") : estado.pomo.fase === "corto" ? L("pausa corta", "short break", "短休息") : L("pausa larga", "long break", "长休息")) + "</b> · " + (estado.pomo.trabajos || 0) + esc(L(" trabajo(s) completados. Al terminar una fase se detiene para que decidas seguir.", " work session(s) completed. At the end of a phase it stops so you decide whether to continue.", " 个工作阶段已完成。阶段结束时会暂停，由你决定是否继续。")) + "</p>";
      ["trabajo", "corto", "largo"].forEach(function (k) {
        $("#pomo-" + k).addEventListener("change", function (e) {
          estado.pomo[k] = Math.max(0.1, Number(e.target.value) || 1);
          if (!tiempoInt) { pomoSeg = Math.round(duracionPomo() * 60); pintaReloj(); }
          guardar(); pintarTiempo();
        });
      });
      $("#pomo-cada").addEventListener("change", function (e) { estado.pomo.cada = Math.max(1, Number(e.target.value) || 4); guardar(); });
    } else if (cfg && estado.tiempoModo === "alarmas") {
      cfg.innerHTML = '<form class="alarma-form" id="alarma-form"><input class="entrada" id="alarma-hora" type="time" aria-label="' + esc(L("Hora de la alarma", "Alarm time", "闹钟时间")) + '">' +
        '<input class="entrada" id="alarma-texto" type="text" placeholder="' + esc(L("Para qué es", "What it is for", "用途")) + '" aria-label="' + esc(L("Texto de la alarma", "Alarm text", "闹钟文字")) + '">' +
        '<button class="btn btn--chico btn-primario" id="alarma-add" type="submit">' + esc(L("+ Alarma", "+ Alarm", "+ 闹钟")) + '</button>' +
        '<button class="btn btn--chico" id="alarma-cancelar" type="button" hidden>' + esc(L("Cancelar", "Cancel", "取消")) + '</button></form>' +
        '<div class="alarma-lista" id="alarma-lista"></div>';
      $("#alarma-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var hora = $("#alarma-hora").value;
        if (!hora) { aviso(L("Elige una hora para la alarma.", "Choose a time for the alarm.", "请选择闹钟时间。")); return; }
        var texto = $("#alarma-texto").value.trim() || L("Alarma", "Alarm", "闹钟");
        var a = formAlarmaId ? (estado.alarmas || []).filter(function (x) { return x.id === formAlarmaId; })[0] : null;
        if (a) {
          a.hora = hora; a.texto = texto; a.ultima = ""; formAlarmaId = null;
          guardar(); pintarTiempo(); aviso(L("Alarma corregida a las ", "Alarm updated to ", "闹钟已改为 ") + hora + ".");
        } else {
          estado.alarmas.push({ id: "a" + Date.now(), hora: hora, texto: texto, activa: true, ultima: "" });
          guardar(); pintarTiempo(); aviso(L("Alarma a las ", "Alarm at ", "闹钟设为 ") + hora + ".");
        }
      });
      if (formAlarmaId) {
        var ae = (estado.alarmas || []).filter(function (x) { return x.id === formAlarmaId; })[0];
        if (ae) {
          $("#alarma-hora").value = ae.hora; $("#alarma-texto").value = ae.texto;
          $("#alarma-add").textContent = "Guardar"; $("#alarma-cancelar").hidden = false;
        } else formAlarmaId = null;
      }
      $("#alarma-cancelar").addEventListener("click", function () {
        formAlarmaId = null; $("#alarma-hora").value = ""; $("#alarma-texto").value = ""; pintarTiempo();
      });
      $("#alarma-lista").innerHTML = (estado.alarmas || []).length ? estado.alarmas.map(function (a) {
        return '<div class="alarma-item' + (a.activa ? "" : " off") + '"><b>' + esc(a.hora) + "</b><span>" + esc(a.texto) + "</span>" +
          '<button class="btn btn--chico" type="button" data-alarma-toggle="' + esc(a.id) + '">' + esc(a.activa ? L("Activa", "Active", "启用") : L("Apagada", "Off", "关闭")) + "</button>" +
          '<button class="calif-x" type="button" data-alarma-editar="' + esc(a.id) + '" title="' + esc(L("Editar alarma", "Edit alarm", "编辑闹钟")) + '" aria-label="' + esc(L("Editar alarma", "Edit alarm", "编辑闹钟")) + '">✎</button>' +
          '<button class="calif-x" type="button" data-alarma-borrar="' + esc(a.id) + '" title="' + esc(L("Quitar alarma", "Remove alarm", "移除闹钟")) + '" aria-label="' + esc(L("Quitar alarma", "Remove alarm", "移除闹钟")) + '">×</button></div>';
      }).join("") : '<p class="muted">' + esc(L("Sin alarmas.", "No alarms.", "没有闹钟。")) + '</p>';
      $$("#alarma-lista [data-alarma-editar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = estado.alarmas.filter(function (x) { return x.id === b.getAttribute("data-alarma-editar"); })[0];
          if (!a) return;
          formAlarmaId = a.id;
          $("#alarma-hora").value = a.hora; $("#alarma-texto").value = a.texto;
          $("#alarma-hora").focus();
          aviso(L("Editando la alarma de las ", "Editing the alarm at ", "正在编辑闹钟 ") + a.hora + L(". Guarda para aplicar.", ". Save to apply.", "。保存后生效。"));
        });
      });
      $$("#alarma-lista [data-alarma-toggle]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = estado.alarmas.filter(function (x) { return x.id === b.getAttribute("data-alarma-toggle"); })[0];
          if (!a) return; a.activa = !a.activa; if (a.activa) a.ultima = ""; guardar(); pintarTiempo();
        });
      });
      $$("#alarma-lista [data-alarma-borrar]").forEach(function (b) {
        b.addEventListener("click", function () {
          estado.alarmas = estado.alarmas.filter(function (x) { return x.id !== b.getAttribute("data-alarma-borrar"); });
          guardar(); pintarTiempo(); aviso(L("Alarma quitada.", "Alarm removed.", "闹钟已移除。"));
        });
      });
    } else if (cfg && estado.tiempoModo === "crono") {
      cfg.innerHTML = '<p class="muted">' + esc(L("Cuenta hacia arriba. Al parar, la sesión se guarda con el ramo y la tarea elegidos.", "Counts up. When you stop, the session is saved with the chosen course and task.", "向上计时。停止时会用所选课程和任务保存会话。")) + '</p>';
    }
    var v = $("#tiempo-vinculo");
    if (v) {
      var ops = ['<option value="">' + esc(L("Sin vínculo", "No link", "无关联")) + '</option>'];
      estado.tareas.forEach(function (t) { ops.push('<option value="' + t.id + '">' + esc(t.titulo) + "</option>"); });
      v.innerHTML = ops.join(""); v.value = estado.tiempoVinculo || "";
      v.onchange = function () { estado.tiempoVinculo = v.value; guardar(); };
    }
    var r = $("#tiempo-ramo");
    if (r) {
      var opsR = ['<option value="">' + esc(L("Sin ramo", "No course", "无课程")) + '</option>'];
      (estado.cursos || []).forEach(function (c) { opsR.push('<option value="' + esc(c.codigo) + '">' + esc(c.codigo) + " — " + esc(c.nombre) + "</option>"); });
      r.innerHTML = opsR.join(""); r.value = estado.tiempoRamo || "";
      r.onchange = function () { estado.tiempoRamo = r.value; guardar(); };
    }
    var ses = estado.sesiones || [], min = 0;
    ses.forEach(function (x) { min += Number(x.minutos || 0); });
    if ($("#tiempo-sesiones")) $("#tiempo-sesiones").textContent = String(ses.length);
    if ($("#tiempo-horas")) $("#tiempo-horas").textContent = fmtHoras(min);
    var listaSes = $("#tiempo-lista-sesiones");
    if (listaSes) {
      listaSes.innerHTML = ses.length ? ses.map(function (x) {
        var vin = x.vinculo ? tareaPorId(x.vinculo) : null;
        var ram = x.ramo ? ramoPorCodigo(x.ramo) : null;
        return '<div class="sesion-item" data-sesion="' + esc(x.id) + '" title="' + esc(L("Clic derecho: editar o borrar", "Right-click: edit or delete", "右键：编辑或删除")) + '"><span><b>' +
          esc(fechaCorta(x.fecha)) + "</b>" + (ram ? " · " + esc(ram.codigo) : "") + (vin ? " · " + esc(vin.titulo) : "") + "</span><small>" +
          esc(fmtDuracion(x.minutos)) + "</small>" +
          '<button class="sesion-x" type="button" data-editar-sesion="' + esc(x.id) + '" title="' + esc(L("Editar sesión", "Edit session", "编辑会话")) + '" aria-label="' + esc(L("Editar sesión", "Edit session", "编辑会话")) + '">✎</button>' +
          '<button class="sesion-x" type="button" data-borrar-sesion="' + esc(x.id) + '" title="' + esc(L("Borrar sesión", "Delete session", "删除会话")) + '" aria-label="' + esc(L("Borrar sesión", "Delete session", "删除会话")) + '">×</button></div>';
      }).join("") : '<p class="muted">' + esc(L("Sin sesiones todavía.", "No sessions yet.", "还没有会话。")) + '</p>';
      $$("#tiempo-lista-sesiones [data-borrar-sesion]").forEach(function (b) {
        b.addEventListener("click", function () { borrarSesion(b.getAttribute("data-borrar-sesion")); });
      });
      $$("#tiempo-lista-sesiones [data-editar-sesion]").forEach(function (b) {
        b.addEventListener("click", function () { abrirSesionModal(b.getAttribute("data-editar-sesion")); });
      });
    }
    var fila = document.querySelector(".tiempo-caja .fila");
    if (fila) fila.hidden = estado.tiempoModo === "alarmas";
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas" || !!tiempoInt;
    $("#btn-pausar").disabled = !tiempoInt;
    $("#btn-parar").disabled = !tiempoInt;
    pintaReloj(); pintarEstadoTiempo();
  }
  function registrarSesion(minutos, tipo) {
    minutos = Math.max(0.01, Math.round((Number(minutos) || 0) * 100) / 100);
    if (!minutos) return;
    estado.sesiones = estado.sesiones || [];
    var d = new Date();
    estado.sesiones.push({
      id: "s" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      fecha: hoyISO(), hora: String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"),
      minutos: minutos, vinculo: estado.tiempoVinculo || "", ramo: estado.tiempoRamo || "", tipo: tipo || "crono"
    });
    guardar(); pintarTiempo(); pintarEstudio();
  }
  function pitido() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.type = "sine"; g.gain.value = 0.08;
      o.connect(g); g.connect(ac.destination); o.start();
      setTimeout(function () { o.stop(); ac.close(); }, 700);
    } catch (e) {}
  }
  function tickTiempo() {
    var modo = estado.tiempoModo || "crono";
    if (modo === "crono") tiempoSeg++;
    else if (modo === "temporizador") {
      tempSeg--;
      if (tempSeg <= 0) {
        tempSeg = 0; clearInterval(tiempoInt); tiempoInt = null;
        registrarSesion(tempInicial / 60, "temporizador");
        aviso(L("Temporizador terminado. Sesión registrada.", "Timer finished. Session logged.", "计时结束。会话已记录。")); pitido(); pintarTiempo(); return;
      }
    } else if (modo === "pomodoro") {
      pomoSeg--;
      if (pomoSeg <= 0) {
        pomoSeg = 0; clearInterval(tiempoInt); tiempoInt = null;
        if (estado.pomo.fase === "trabajo") {
          registrarSesion(pomoInicial / 60, "pomodoro");
          estado.pomo.trabajos = (estado.pomo.trabajos || 0) + 1;
          estado.pomo.fase = estado.pomo.trabajos % (estado.pomo.cada || 4) === 0 ? "largo" : "corto";
          aviso(L("Pomodoro completado. Descansa: ", "Pomodoro complete. Rest: ", "番茄钟完成。休息：") + (estado.pomo.fase === "corto" ? L("pausa corta", "short break", "短休息") : L("pausa larga", "long break", "长休息")) + ".");
        } else {
          estado.pomo.fase = "trabajo";
          aviso(L("Pausa terminada. Vuelve al trabajo.", "Break over. Back to work.", "休息结束。回到工作。"));
        }
        guardar(); pitido(); pintarTiempo(); return;
      }
    }
    pintaReloj(); pintarEstadoTiempo();
  }
  function empezarTiempo() {
    if (tiempoInt || estado.tiempoModo === "alarmas") return;
    if (estado.tiempoModo === "temporizador" && tempSeg <= 0) tempSeg = Math.round(Math.max(0.1, Number(estado.tempMin) || 25) * 60);
    if (estado.tiempoModo === "temporizador") tempInicial = tempSeg;
    if (estado.tiempoModo === "pomodoro" && pomoSeg <= 0) pomoSeg = Math.round(duracionPomo() * 60);
    if (estado.tiempoModo === "pomodoro") pomoInicial = pomoSeg;
    tiempoInt = setInterval(tickTiempo, 1000);
    $("#btn-empezar").disabled = true; $("#btn-pausar").disabled = false; $("#btn-parar").disabled = false;
    pintarEstadoTiempo();
  }
  function pausarTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    $("#btn-empezar").disabled = false; $("#btn-pausar").disabled = true;
    pintarEstadoTiempo();
  }
  function pararTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    if (estado.tiempoModo === "crono" && tiempoSeg > 0) registrarSesion(tiempoSeg / 60, "crono");
    else if (estado.tiempoModo === "temporizador" && tempInicial > tempSeg) registrarSesion((tempInicial - tempSeg) / 60, "temporizador");
    else if (estado.tiempoModo === "pomodoro" && estado.pomo.fase === "trabajo" && pomoInicial > pomoSeg) registrarSesion((pomoInicial - pomoSeg) / 60, "pomodoro");
    tiempoSeg = 0; tempSeg = 0; pomoSeg = 0; tempInicial = 0; pomoInicial = 0;
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas"; $("#btn-pausar").disabled = true; $("#btn-parar").disabled = true;
    pintaReloj(); pintarEstadoTiempo();
  }
  function reiniciarTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    tiempoSeg = 0; tempSeg = 0; pomoSeg = 0; tempInicial = 0; pomoInicial = 0;
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas"; $("#btn-pausar").disabled = true; $("#btn-parar").disabled = true;
    pintarTiempo();
  }
  function cambiarModoTiempo(id) {
    if (estado.tiempoHijos.indexOf(id) === -1) return;
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    estado.tiempoModo = id;
    formAlarmaId = null;
    if (id === "temporizador") { tempSeg = Math.round(Math.max(0.1, Number(estado.tempMin) || 25) * 60); tempInicial = tempSeg; }
    if (id === "pomodoro") { pomoSeg = Math.round(duracionPomo() * 60); pomoInicial = pomoSeg; }
    guardar(); pintarTiempo();
  }
  function comprobarAlarmas() {
    var d = new Date(), hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    var hoy = hoyISO();
    (estado.alarmas || []).forEach(function (a) {
      if (!a.activa || a.hora !== hh || a.ultima === hoy) return;
      a.ultima = hoy; guardar(); aviso(L("Alarma: ", "Alarm: ", "闹钟：") + a.texto); pitido();
      try {
        if (estado.prefs.notificaciones !== false && typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            new Notification("Mimo · " + L("alarma", "alarm", "闹钟"), { body: a.texto, tag: "mimo-" + a.id });
          } else if (Notification.permission === "default") {
            Notification.requestPermission();
          }
        }
      } catch (e) {}
    });
  }
  function tarjetaPanel(id) {
    var b = BLOQUES[id] || { nombre: nombre(id), desc: "Sección base." };
    return '<div class="panel__bloque"><span>' + esc(nombre(id)) + "</span><small>" +
      (BASE.indexOf(id) !== -1 ? L("base", "base", "基础") : L("instalado", "installed", "已安装")) + "</small></div>";
  }
  function panelTab() { return estado.panel[pantalla] || "contexto"; }
  function notasEnlazadasA(tipo, id) {
    return (estado.notas || []).filter(function (n) {
      var e = n.enlaces && n.enlaces[0];
      return e && e.tipo === tipo && String(e.id) === String(id);
    });
  }
  function bloqueNotasEnlazadas(tipo, id) {
    var ns = notasEnlazadasA(tipo, id);
    if (!ns.length) return "";
    return '<div class="panel__bloque"><span>' + esc(t("panel.notasEnlazadas")) + '</span><small>' + ns.map(function (n) {
      return '<button class="btn btn--chico" type="button" data-abrir-enlace="nota:' + esc(n.id) + '">' + esc(n.titulo || t("panel.sinTitulo")) + "</button>";
    }).join(" ") + "</small></div>";
  }
  function pintarPanelEn(id) {
    var prev = pantalla;
    pantalla = id;
    pintarPanel();
    pantalla = prev;
  }
  function pintarPanel() {
    var tab = panelTab();
    $$(".panel__tab").forEach(function (b) {
      var on = b.getAttribute("data-ptab") === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var html = "";
    if (tab === "detalle") {
      var tareaP = tareaPorId(estado.tareaSel);
      var n = notaActual();
      var ev = eventoPorId(estado.eventoSel);
      var ramo = ramoPorCodigo(estado.ramoSel);
      if (pantalla === "calificaciones" && ramo) {
        var qc = califDe(ramo.codigo), estC = estadoCalifDe(qc, ramo);
        html = "<h2>" + esc(L("Calificaciones", "Grades", "成绩")) + "</h2><h3>" + esc(ramo.codigo) + " — " + esc(ramo.nombre) + "</h3>" +
          '<div class="panel__bloque"><span>' + esc(L("Presentación", "Presentation", "平时成绩")) + '</span><small>' + fmtNota(presentacionDe(qc)) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(L("Final", "Final", "最终")) + '</span><small>' + fmtNota(notaFinalDe(qc)) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(L("Estado", "Status", "状态")) + '</span><small>' + esc(estC.texto) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(L("Componentes", "Components", "评分项")) + '</span><small>' + qc.componentes.length + " · " + qc.categorias.length + " " + esc(L("categorías", "categories", "分类")) + "</small></div>" +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-abrir-calif="' + esc(ramo.codigo) + '">' + esc(L("Abrir", "Open", "打开")) + '</button></div>';
      } else if (pantalla === "malla" && ramo) {
        var estR = estadoDeRamo(ramo), faltanR = faltantesDe(ramo), reqR = requisitosTexto(ramo);
        html = "<h2>" + esc(L("Ramo", "Course", "课程")) + "</h2><h3>" + esc(ramo.codigo) + " — " + esc(ramo.nombre) + "</h3>" +
          '<div class="panel__bloque"><span>' + esc(L("Estado", "Status", "状态")) + '</span><small>' + esc(etiquetaEstado(estR)) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(L("Créditos", "Credits", "学分")) + '</span><small>' + creditosDe(ramo) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(L("Nivel", "Level", "层级")) + '</span><small>' + esc(etiquetaNivel(ramo.nivel)) + "</small></div>" +
          (reqR ? '<div class="panel__bloque"><span>' + esc(L("Requiere", "Requires", "需要")) + '</span><small>' + esc(reqR) + "</small></div>" : "") +
          (faltanR.length ? '<h2>' + esc(L("Falta", "Missing", "缺少")) + '</h2><p class="panel__nota">' + esc(faltanR.join(", ")) + "</p>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-ramo="' + esc(ramo.codigo) + '">' + esc(L("Editar", "Edit", "编辑")) + '</button>' +
          '<button class="btn btn--chico" type="button" data-toggle-ramo="' + esc(ramo.codigo) + '">' + (ramo.cerrado ? L("Reabrir", "Reopen", "重新打开") : L("Cerrar curso", "Close course", "关闭课程")) + "</button>" +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-ramo="' + esc(ramo.codigo) + '">' + esc(L("Borrar", "Delete", "删除")) + '</button></div>';
      } else if (pantalla === "calendario" && ev) {
        html = "<h2>" + esc(t("panel.evento")) + "</h2><h3>" + esc(ev.titulo) + "</h3>" +
          '<div class="panel__bloque"><span>' + esc(t("panel.fecha")) + '</span><small>' + esc(ev.fecha) + "</small></div>" +
          (ev.hora ? '<div class="panel__bloque"><span>' + esc(t("panel.hora")) + '</span><small>' + esc(ev.hora) + "</small></div>" : "") +
          (ev.contexto ? '<div class="panel__bloque"><span>' + esc(t("panel.contexto")) + '</span><small>' + esc(ev.contexto) + "</small></div>" : "") +
          (ev.nota ? '<p class="panel__nota">' + esc(ev.nota) + "</p>" : "") +
          bloqueNotasEnlazadas("evento", ev.id) +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-evento="' + ev.id + '">' + esc(t("acc.editar")) + '</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-evento="' + ev.id + '">' + esc(t("acc.borrar")) + "</button></div>";
      } else if (pantalla === "tareas" && tareaP) {
        var p = progreso(tareaP), hijos = hijosDe(tareaP.id), padre = tareaP.padre_id ? tareaPorId(tareaP.padre_id) : null;
        html = "<h2>" + esc(t(tareaP.tipo === "proyecto" ? "panel.proyecto" : "panel.tarea")) + "</h2><h3>" + esc(tareaP.titulo) + "</h3>" +
          '<div class="panel__bloque"><span>' + esc(t("panel.estado")) + '</span><small>' + esc(t(tareaP.hecha ? "panel.hecha" : "panel.abierta")) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(t("panel.fecha")) + '</span><small>' + esc(fechaCorta(tareaP.fecha)) + "</small></div>" +
          '<div class="panel__bloque"><span>' + esc(t("panel.prioridad")) + '</span><small>' + esc(etiquetaPrioridad(tareaP.prioridad)) + "</small></div>" +
          (tareaP.contexto ? '<div class="panel__bloque"><span>' + esc(t("panel.contexto")) + '</span><small>' + esc(tareaP.contexto) + "</small></div>" : "") +
          (padre ? '<div class="panel__bloque"><span>' + esc(t("panel.dentroDe")) + '</span><small>' + esc(padre.titulo) + "</small></div>" : "") +
          (tareaP.tipo === "proyecto" ? '<h2>' + esc(t("panel.progreso")) + '</h2><div class="tarea-progreso" style="width:100%"><i style="width:' + p.pct + '%"></i></div><p class="panel__nota">' + p.pct + " % · " + esc(tf("panel.progresoTareas", { hechas: p.hechas, total: p.total })) + "</p>" +
            '<h2>' + esc(t("panel.subtareas")) + '</h2>' + (hijos.length ? hijos.map(function (h) { return '<div class="panel__bloque"><span>' + esc(h.titulo) + "</span><small>" + esc(t(h.hecha ? "panel.hecha" : "panel.abierta")) + "</small></div>"; }).join("") : '<p class="panel__nota">' + esc(t("panel.sinSubtareas")) + '</p>') : "") +
          (tareaP.nota ? '<h2>' + esc(t("panel.nota")) + '</h2><p class="panel__nota">' + esc(tareaP.nota) + "</p>" : "") +
          bloqueNotasEnlazadas("tarea", tareaP.id) +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-tarea="' + tareaP.id + '">' + esc(t("acc.editar")) + '</button>' +
          '<button class="btn btn--chico" type="button" data-toggle-tarea="' + tareaP.id + '">' + esc(t(tareaP.hecha ? "panel.reabrir" : "panel.marcarHecha")) + "</button>" +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-tarea="' + tareaP.id + '">' + esc(t("acc.borrar")) + "</button></div>";

      } else if (pantalla === "notas" && n) {
        html = "<h2>" + esc(L("Detalle de la nota", "Note details", "笔记详情")) + "</h2><h3>" + (n.fijada ? "★ " : "") + esc(!n.titulo || n.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : n.titulo) +
          '</h3><p class="panel__nota">' + esc((n.cuerpo || "").slice(0, 240) || L("Vacía", "Empty", "空白")) + "</p>" +
          (n.contexto ? '<div class="panel__bloque"><span>' + esc(L("Contexto", "Context", "情境")) + '</span><small>' + esc(n.contexto) + "</small></div>" : "") +
          (n.etiquetas.length ? '<div class="panel__bloque"><span>' + esc(L("Etiquetas", "Tags", "标签")) + '</span><small>' + esc(n.etiquetas.join(", ")) + "</small></div>" : "") +
          (n.enlaces.length ? '<div class="panel__bloque"><span>' + esc(L("Enlazada a", "Linked to", "链接到")) + '</span><small><button class="btn btn--chico" type="button" data-abrir-enlace="' + esc(n.enlaces[0].tipo) + ':' + esc(n.enlaces[0].id) + '">' + esc(n.enlaces[0].titulo) + "</button></small></div>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-abrir-nota="' + n.id + '">' + esc(L("Abrir", "Open", "打开")) + '</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-nota="' + n.id + '">' + esc(L("Borrar", "Delete", "删除")) + '</button></div>';
      } else {
        html = '<h2>' + esc(t("panel.detalle")) + '</h2><p class="panel__nota">' + esc(t("panel.detalleVacio")) + '</p>';
      }
    } else if (tab === "notas") {
      var nn = notaActual();
      html = '<h2>' + esc(L("Nota abierta", "Open note", "打开的笔记")) + '</h2>' + (nn
        ? "<h3>" + esc(!nn.titulo || nn.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : nn.titulo) + '</h3><p class="panel__nota">' + esc((nn.cuerpo || "").slice(0, 240) || L("Vacía", "Empty", "空白")) + "</p>"
        : '<p class="panel__nota">' + esc(L("Sin nota abierta. Crea una en Notas.", "No note open. Create one in Notes.", "没有打开的笔记。请在笔记中创建。")) + '</p>');
    } else if (tab === "bloques") {
      html = '<h2>' + esc(L("Base fija", "Fixed base", "固定基础")) + '</h2>' + ["calendario", "tareas", "notas", "ajustes"].map(tarjetaPanel).join("") +
        '<h2>' + esc(L("Instalados", "Installed", "已安装")) + '</h2>' + (estado.instalados.length ? estado.instalados.map(tarjetaPanel).join("")
          : '<p class="panel__nota">' + esc(L("Ninguno. La app funciona solo con la base.", "None. The app works with the base alone.", "没有。应用仅靠基础模块也能运行。")) + '</p>') +
        '<button class="btn panel__anadir" type="button" data-abrir-modal>' + esc(L("+ Agregar bloque o kit", "+ Add block or kit", "+ 添加模块或套件")) + '</button>';
    } else {
      var cuentas = {
        calendario: [estado.eventos.length + " " + t(estado.eventos.length === 1 ? "cal.evento" : "cal.eventos"), estado.eventos.length ? t("panel.proximoEvento") : t("panel.sinEventos")],
        tareas: [estado.tareas.length + " " + L("tareas", "tasks", "任务"), estado.tareas.filter(function (x) { return !x.hecha; }).length + " " + L("abiertas", "open", "未完成")],
        notas: [estado.notas.length + " " + L("notas", "notes", "笔记"), L("Lista y editor en la misma sección.", "List and editor in the same section.", "列表和编辑器在同一分区。")],
        malla: [(estado.cursos || []).length + " " + L("ramos", "courses", "门课程"), L("Cursos, niveles, prerrequisitos y créditos.", "Courses, levels, prerequisites and credits.", "课程、层级、先修要求和学分。")],
        calificaciones: [(estado.cursos || []).length + " " + L("ramos", "courses", "门课程"), L("Notas por categoría, examen y eximición.", "Grades by category, exam and exemption.", "按分类、考试和免考计算成绩。")],
        estudio: [(estado.sesiones || []).length + " " + L("sesiones", "sessions", "会话"), L("Horas por ramo y meta semanal.", "Hours per course and weekly goal.", "按课程小时和每周目标。")],
        tiempo: [estado.tiempoHijos.length + " " + L("bloques dentro", "blocks inside", "个模块"), L("Cronómetro, temporizador, pomodoro y alarmas.", "Stopwatch, timer, pomodoro and alarms.", "秒表、计时器、番茄钟和闹钟。")],
        ajustes: [TEMAS.length + " " + L("temas", "themes", "主题"), L("Apariencia, paneles, bloques y laboratorio.", "Appearance, panels, blocks and lab.", "外观、面板、模块和实验室。")]
      }[pantalla] || [t("panel.sinContexto"), t("panel.estaSeccion")];
      html = "<h2>" + esc(nombre(pantalla)) + '</h2><p class="panel__nota">' + esc(cuentas[1]) +
        '</p><div class="panel__bloque"><span>' + esc(t("panel.ahora")) + '</span><small>' + esc(cuentas[0]) + "</small></div>";
    }
    $("#panel-cuerpo").innerHTML = html;
    $$("#panel-cuerpo [data-abrir-modal]").forEach(function (b) { b.addEventListener("click", abrirModal); });
    $$("#panel-cuerpo [data-editar-tarea]").forEach(function (b) {
      b.addEventListener("click", function () { abrirFormulario(tareaPorId(b.getAttribute("data-editar-tarea"))); });
    });
    $$("#panel-cuerpo [data-toggle-tarea]").forEach(function (b) {
      b.addEventListener("click", function () {
        var x = tareaPorId(b.getAttribute("data-toggle-tarea")); if (!x) return;
        x.hecha = !x.hecha; x.estado = x.hecha ? "hecha" : "pendiente";
        guardar(); pintarTareas(); pintarPanel();
      });
    });
    $$("#panel-cuerpo [data-borrar-tarea]").forEach(function (b) {
      b.addEventListener("click", function () { borrarTarea(b.getAttribute("data-borrar-tarea")); });
    });
    $$("#panel-cuerpo [data-editar-evento]").forEach(function (b) {
      b.addEventListener("click", function () { abrirEvento(eventoPorId(b.getAttribute("data-editar-evento"))); });
    });
    $$("#panel-cuerpo [data-borrar-evento]").forEach(function (b) {
      b.addEventListener("click", function () { borrarEvento(b.getAttribute("data-borrar-evento")); });
    });
    $$("#panel-cuerpo [data-abrir-nota]").forEach(function (b) {
      b.addEventListener("click", function () { abrirNota(b.getAttribute("data-abrir-nota")); });
    });
    $$("#panel-cuerpo [data-abrir-enlace]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = String(b.getAttribute("data-abrir-enlace")).split(":");
        if (p[0] === "nota") abrirNota(p[1]);
        else if (p[0] === "tarea") abrirTarea(p[1]);
        else if (p[0] === "evento") abrirEventoDetalle(p[1]);
      });
    });
    $$("#panel-cuerpo [data-borrar-nota]").forEach(function (b) {
      b.addEventListener("click", function () { borrarNota(b.getAttribute("data-borrar-nota")); });
    });
    $$("#panel-cuerpo [data-abrir-calif]").forEach(function (b) {
      b.addEventListener("click", function () {
        califSel = b.getAttribute("data-abrir-calif"); estado.califSel = califSel;
        ir("calificaciones"); pintarCalificaciones();
        if (window.innerWidth <= 1255) abrirPanel();
      });
    });
    $$("#panel-cuerpo [data-editar-ramo]").forEach(function (b) {
      b.addEventListener("click", function () { abrirFormularioRamo(ramoPorCodigo(b.getAttribute("data-editar-ramo"))); });
    });
    $$("#panel-cuerpo [data-toggle-ramo]").forEach(function (b) {
      b.addEventListener("click", function () { alternarRamo(b.getAttribute("data-toggle-ramo")); });
    });
    $$("#panel-cuerpo [data-borrar-ramo]").forEach(function (b) {
      b.addEventListener("click", function () { borrarRamo(b.getAttribute("data-borrar-ramo")); });
    });
    var pie = $("#pie-centro");
    if (pie) pie.textContent = nombre(pantalla);
  }

  function aplicarPrefs() {
    var p = estado.prefs || {};
    document.documentElement.style.setProperty("--ancho-panel", (p.panelAncho || "320") + "px");
    document.body.classList.toggle("nav-izq", p.navPos === "izquierda");
    var fi = $("#pref-inicio"), fh = $("#pref-hora"), fp = $("#pref-panel-ancho");
    if (fi) fi.value = p.inicioSemana || "lunes";
    if (fh) fh.value = p.hora || "24";
    if (fp) fp.value = p.panelAncho || "320";
    if ($("#pref-nav")) $("#pref-nav").value = p.navPos || "arriba";
    if ($("#pref-idioma")) $("#pref-idioma").value = p.idioma || "es";
    pintarBandera();
    if ($("#pref-notif")) $("#pref-notif").checked = p.notificaciones !== false;
    if ($("#pref-panel-abierto")) $("#pref-panel-abierto").checked = p.panelAbierto !== false;
    var lab = $("#lab-split"); if (lab) lab.checked = splitOn;
  }
  function pintarBandera() {
    var c = $("#idioma-bandera"); if (!c) return;
    var i = idioma();
    if (i === "zh") c.innerHTML = '<span class="idioma-emoji" aria-hidden="true">🇨🇳</span>';
    else if (i === "en") c.innerHTML = '<span class="idioma-emoji" aria-hidden="true">🇬🇧</span>';
    else c.innerHTML = '<img src="img/bandera-sudamerica.webp" alt="">';
  }
  function aplicarIdioma() {
    var i = idioma();
    document.documentElement.lang = i === "zh" ? "zh-CN" : i === "es" ? "es-CL" : "en";
    $$("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v) el.textContent = v;
    });
    $$("[data-i18n-placeholder]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-placeholder"));
      if (v) el.setAttribute("placeholder", v);
    });
    $$("[data-i18n-title]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-title"));
      if (v) el.setAttribute("title", v);
    });
    $$("[data-i18n-aria]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-aria"));
      if (v) el.setAttribute("aria-label", v);
    });
    var suf = idioma() === "zh" ? "zh" : idioma() === "en" ? "en" : "es";
    $$("[data-l10n-es]").forEach(function (el) {
      var v = el.getAttribute("data-l10n-" + suf) || el.getAttribute("data-l10n-es");
      if (v != null) el.textContent = v;
    });
    $$("[data-l10n-ph-es]").forEach(function (el) {
      var v = el.getAttribute("data-l10n-ph-" + suf) || el.getAttribute("data-l10n-ph-es");
      if (v != null) el.setAttribute("placeholder", v);
    });
    $$("[data-l10n-aria-es]").forEach(function (el) {
      var v = el.getAttribute("data-l10n-aria-" + suf) || el.getAttribute("data-l10n-aria-es");
      if (v != null) el.setAttribute("aria-label", v);
    });
    $$("[data-l10n-title-es]").forEach(function (el) {
      var v = el.getAttribute("data-l10n-title-" + suf) || el.getAttribute("data-l10n-title-es");
      if (v != null) el.setAttribute("title", v);
    });
    pintarBandera();
    pintarTabs();
  }
  function repintarIdioma() {
    aplicarIdioma();
    pintarTemaIcono();
    pintarTemas();
    pintarPeriodo();
    pintarCalendario();
    pintarTareas();
    pintarNotas();
    pintarMalla();
    pintarCalificaciones();
    pintarEstudio();
    pintarTiempo();
    pintarPanel();
    pintarSplit();
    pintarAjustes();
  }
  function pintarAjustes() {
    var p = estado.prefs || {};
    var b = $("#ajustes-bloques"); if (b) b.textContent = estado.instalados.length + " " + L("bloques instalados.", "blocks installed.", "个模块已安装。");
    var r = $("#ajustes-resumen");
    if (r) r.textContent = estado.tareas.length + " " + L("tareas", "tasks", "任务") + " · " + estado.eventos.length + " " + L("eventos", "events", "事件") + " · " + estado.notas.length + " " + L("notas", "notes", "笔记") + " · " + (estado.cursos || []).length + " " + L("ramos", "courses", "门课程") + " · " + (estado.periodos || []).length + " " + L("periodos", "terms", "学期") + ".";
    var d = $("#ajustes-datos");
    if (d) d.textContent = L("Datos en este equipo: ", "Data on this device: ", "此设备上的数据：") + estado.tareas.length + " " + L("tareas", "tasks", "任务") + ", " + estado.eventos.length + " " + L("eventos", "events", "事件") + ", " + estado.notas.length + " " + L("notas", "notes", "笔记") + ", " + (estado.cursos || []).length + " " + L("ramos", "courses", "门课程") + ". " + L("Nada sale de aquí.", "Nothing leaves this device.", "不会离开此设备。");
    var pl = $("#ajustes-periodos");
    if ($("#ajustes-idioma")) {
      var nombres = { es: "Español (Latinoamérica)", en: "English", zh: "中文（简体）" };
      var estadoIdioma = {
        es: "Idioma activo: " + (nombres[p.idioma] || nombres.es) + ". Navegación y secciones cambian en caliente.",
        en: "Active language: " + (nombres[p.idioma] || nombres.es) + ". Navigation and sections change live.",
        zh: "当前语言：" + (nombres[p.idioma] || nombres.es) + "。导航和分区即时切换。"
      };
      $("#ajustes-idioma").textContent = estadoIdioma[p.idioma] || estadoIdioma.es;
    }
    if (pl) {
      pl.innerHTML = (estado.periodos || []).length ? estado.periodos.map(function (x) {
        return '<div class="periodo-item' + (x.id === estado.periodoActivo ? " on" : "") + '" data-periodo-item="' + x.id + '"><span><b>' + esc(x.nombre) + '</b><br><small class="muted">' + x.semanas.length + ' semanas</small></span>' +
          '<span class="fila"><button class="btn btn--chico" type="button" data-periodo-aj="' + x.id + '">' + esc(L("Usar", "Use", "使用")) + '</button>' +
          '<button class="btn btn--chico" type="button" data-editar-periodo="' + x.id + '">' + esc(L("Editar", "Edit", "编辑")) + '</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-periodo="' + x.id + '">' + esc(L("Borrar", "Delete", "删除")) + '</button></span></div>';
      }).join("") : '<p class="muted">' + esc(L("Sin periodos. Crea el primero.", "No terms. Create the first one.", "没有学期。创建第一个。")) + '</p>';
      $$("#ajustes-periodos [data-periodo-aj]").forEach(function (x) {
        x.addEventListener("click", function () { estado.periodoActivo = x.getAttribute("data-periodo-aj"); guardar(); pintarPeriodo(); pintarAjustes(); });
      });
      $$("#ajustes-periodos [data-editar-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { abrirPeriodo(x.getAttribute("data-editar-periodo")); });
      });
      $$("#ajustes-periodos [data-borrar-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { borrarPeriodo(x.getAttribute("data-borrar-periodo")); });
      });
    }
    aplicarPrefs();
  }
  function horaTexto(h) {
    if (!h) return "";
    if ((estado.prefs || {}).hora === "12") {
      var p = h.split(":"); var n = parseInt(p[0], 10); var suf = n >= 12 ? "pm" : "am"; n = n % 12 || 12;
      return n + ":" + p[1] + " " + suf;
    }
    return h;
  }
  function periodoActivoObj() {
    return (estado.periodos || []).filter(function (p) { return p.id === estado.periodoActivo; })[0] || null;
  }
  function pintarPeriodo() {
    var p = periodoActivoObj();
    var b = $("#btn-periodo");
    if (b) b.textContent = p ? p.nombre : t("periodo.sin");
    pintarAjustes();
    var lista = $("#periodos-lista");
    if (lista) {
      lista.innerHTML = (estado.periodos || []).length ? estado.periodos.map(function (x) {
        return '<div class="periodo-item' + (x.id === estado.periodoActivo ? " on" : "") + '" data-periodo-item="' + x.id + '"><span><b>' + esc(x.nombre) + '</b><br><small class="muted">' + esc(x.inicio) + " · " + x.semanas.length + " " + L("semanas", "weeks", "周") + '</small></span>' +
          '<span class="fila"><button class="btn btn--chico" type="button" data-periodo="' + x.id + '">' + esc(L("Usar", "Use", "使用")) + '</button>' +
          '<button class="btn btn--chico" type="button" data-editar-periodo="' + x.id + '">' + esc(L("Editar", "Edit", "编辑")) + '</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-periodo="' + x.id + '">' + esc(L("Borrar", "Delete", "删除")) + '</button></span></div>';
      }).join("") : '<p class="muted">' + esc(L("Todavía no hay periodos.", "No terms yet.", "还没有学期。")) + '</p>';
      $$("#periodos-lista [data-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { estado.periodoActivo = x.getAttribute("data-periodo"); guardar(); pintarPeriodo(); aviso(L("Periodo activo.", "Term set active.", "学期已设为当前。")); });
      });
      $$("#periodos-lista [data-editar-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { abrirPeriodo(x.getAttribute("data-editar-periodo")); });
      });
      $$("#periodos-lista [data-borrar-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { borrarPeriodo(x.getAttribute("data-borrar-periodo")); });
      });
    }
    pintarCalendario();
  }
  function tipoSemanaTexto(t) {
    return t === "receso" ? L("Receso", "Break", "假期") : t === "examenes" ? L("Exámenes", "Exams", "考试") : L("Clases", "Classes", "课程");
  }
  function siguienteTipoSemana(t) {
    return t === "clases" ? "receso" : t === "receso" ? "examenes" : "clases";
  }
  function regenerarMapaPeriodo() {
    var total = Math.max(1, parseInt($("#periodo-semanas").value, 10) || 18);
    var receso = Math.max(0, parseInt($("#periodo-receso").value, 10) || 0);
    var exam = Math.max(0, parseInt($("#periodo-examenes").value, 10) || 0);
    var clases = Math.max(0, total - receso - exam);
    mapaPeriodo = [];
    for (var i = 0; i < total; i++) {
      mapaPeriodo.push({ tipo: i < clases ? "clases" : i < clases + receso ? "receso" : "examenes" });
    }
    pintarMapaPeriodo();
  }
  function pintarMapaPeriodo() {
    var c = $("#periodo-mapa"); if (!c) return;
    if (!mapaPeriodo) regenerarMapaPeriodo();
    var inicio = $("#periodo-inicio").value || hoyISO();
    var base = new Date(inicio + "T12:00:00");
    c.innerHTML = mapaPeriodo.map(function (w, i) {
      var d = new Date(base.getTime()); d.setDate(d.getDate() + i * 7);
      var etiqueta = d.getDate() + "/" + (d.getMonth() + 1);
      return '<button class="semana-chip tipo-' + w.tipo + '" type="button" data-mapa-semana="' + i + '" title="' + esc(L("Clic para cambiar el tipo", "Click to change the type", "点击更改类型")) + '">' +
        "<b>S" + (i + 1) + "</b><span>" + tipoSemanaTexto(w.tipo) + "</span><small>" + etiqueta + "</small></button>";
    }).join("");
    $$("#periodo-mapa [data-mapa-semana]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-mapa-semana"), 10);
        if (!mapaPeriodo[i]) return;
        mapaPeriodo[i].tipo = siguienteTipoSemana(mapaPeriodo[i].tipo);
        actualizarContadoresMapa();
        pintarMapaPeriodo();
      });
    });
  }
  function actualizarContadoresMapa() {
    if (!mapaPeriodo) return;
    var receso = mapaPeriodo.filter(function (w) { return w.tipo === "receso"; }).length;
    var exam = mapaPeriodo.filter(function (w) { return w.tipo === "examenes"; }).length;
    $("#periodo-receso").value = receso;
    $("#periodo-examenes").value = exam;
  }
  function cambiarTipoSemanaCalendario(desde) {
    var p = periodoActivoObj();
    var w = p && (p.semanas || []).filter(function (x) { return x.desde === desde; })[0];
    if (!w) return;
    w.tipo = siguienteTipoSemana(w.tipo || "clases");
    guardar(); pintarPeriodo();
    aviso(L("Semana marcada como ", "Week marked as ", "已标记为 ") + tipoSemanaTexto(w.tipo).toLowerCase() + ".");
  }
  function abrirPeriodo(id) {
    if (typeof id !== "string") id = null;
    formPeriodoId = id;
    var p = id ? (estado.periodos || []).filter(function (x) { return x.id === id; })[0] : null;
    $("#periodo-tit").textContent = p ? L("Editar periodo", "Edit term", "编辑学期") : L("Nuevo periodo", "New term", "新建学期");
    $("#periodo-form button[type=submit]").textContent = p ? L("Guardar periodo", "Save term", "保存学期") : L("Crear periodo", "Create term", "创建学期");
    $("#periodo-nombre").value = p ? p.nombre : "";
    $("#periodo-inicio").value = p ? (p.inicio || hoyISO()) : hoyISO();
    var semanas = p && Array.isArray(p.semanas) ? p.semanas : [];
    var receso = semanas.filter(function (w) { return w.tipo === "receso"; }).length;
    var exam = semanas.filter(function (w) { return w.tipo === "examenes"; }).length;
    $("#periodo-semanas").value = semanas.length || 18;
    $("#periodo-receso").value = p ? receso : 1;
    $("#periodo-examenes").value = p ? exam : 3;
    mapaPeriodo = p ? semanas.map(function (w) { return { tipo: w.tipo || "clases" }; }) : null;
    if (p) pintarMapaPeriodo(); else regenerarMapaPeriodo();
    $("#modal-periodo").classList.add("on");
    pintarPeriodo();
    $("#periodo-nombre").focus();
    $("#periodo-nombre").select();
  }
  function cerrarPeriodo() {
    $("#modal-periodo").classList.remove("on");
    formPeriodoId = null;
    mapaPeriodo = null;
    $("#periodo-tit").textContent = L("Nuevo periodo", "New term", "新建学期");
    $("#periodo-form button[type=submit]").textContent = L("Crear periodo", "Create term", "创建学期");
  }

  /* ---- U6: buscador global ---- */
  var buscarAcciones = [];
  function resultadosBusqueda(q) {
    var low = String(q || "").toLowerCase().trim(), out = [];
    if (!low) return out;
    function tiene() {
      for (var i = 0; i < arguments.length; i++) {
        if (String(arguments[i] || "").toLowerCase().indexOf(low) !== -1) return true;
      }
      return false;
    }
    (estado.tareas || []).forEach(function (t) {
      if (!tiene(t.titulo, t.contexto, t.nota)) return;
      out.push({ tipo: L("Tarea", "Task", "任务"), titulo: t.titulo, sub: (t.tipo === "proyecto" ? L("Proyecto", "Project", "项目") : L("Tarea", "Task", "任务")) + (t.fecha ? " · " + fechaCorta(t.fecha) : "") + (t.contexto ? " · " + t.contexto : ""),
        run: function () { abrirTarea(t.id); } });
    });
    (estado.notas || []).forEach(function (n) {
      if (!tiene(n.titulo, n.cuerpo, n.contexto, (n.etiquetas || []).join(" "))) return;
      out.push({ tipo: L("Nota", "Note", "笔记"), titulo: n.titulo || L("Sin título", "Untitled", "无标题"), sub: (n.contexto || L("Sin contexto", "No context", "无情境")) + " · " + ((n.cuerpo || "").slice(0, 45) || L("Vacía", "Empty", "空白")),
        run: function () { abrirNota(n.id); } });
    });
    (estado.eventos || []).forEach(function (ev) {
      if (!tiene(ev.titulo, ev.contexto, ev.nota)) return;
      out.push({ tipo: L("Evento", "Event", "事件"), titulo: ev.titulo, sub: ev.fecha + (ev.hora ? " · " + ev.hora : "") + (ev.contexto ? " · " + ev.contexto : ""),
        run: function () { abrirEventoDetalle(ev.id); } });
    });
    (estado.cursos || []).forEach(function (c) {
      if (!tiene(c.codigo, c.nombre)) return;
      out.push({ tipo: L("Ramo", "Course", "课程"), titulo: c.codigo + " — " + c.nombre, sub: creditosDe(c) + " cr · " + etiquetaEstado(estadoDeRamo(c)),
        run: function () {
          estado.ramoSel = c.codigo; estado.panel.malla = "detalle"; guardar();
          ir("malla"); pintarMalla(); pintarPanel();
        } });
    });
    (estado.periodos || []).forEach(function (p) {
      if (!tiene(p.nombre)) return;
      out.push({ tipo: L("Periodo", "Term", "学期"), titulo: p.nombre, sub: p.semanas.length + " " + L("semanas", "weeks", "周") + " · " + (p.id === estado.periodoActivo ? L("activo", "active", "当前") : L("guardado", "saved", "已保存")),
        run: function () { estado.periodoActivo = p.id; guardar(); pintarPeriodo(); ir("calendario"); aviso(L("Periodo activo: ", "Active term: ", "当前学期：") + p.nombre); } });
    });
    return out.slice(0, 30);
  }
  function pintarBusqueda() {
    var q = $("#buscar-input") ? $("#buscar-input").value.trim() : "";
    var caja = $("#buscar-resultados"); if (!caja) return;
    var res = resultadosBusqueda(q);
    buscarAcciones = res.map(function (r) { return r.run; });
    if (!q) {
      caja.innerHTML = '<div class="buscar-vacio"><b>' + esc(L("Busca una cosa a la vez", "Search one thing at a time", "一次搜索一件事")) + '</b><p>' + esc(L("Tareas, notas, eventos, ramos y periodos. Escribe al menos una letra.", "Tasks, notes, events, courses and terms. Type at least one letter.", "任务、笔记、事件、课程和学期。至少输入一个字母。")) + '</p>' +
        '<div class="buscar-resumen"><span>' + estado.tareas.length + " " + L("tareas", "tasks", "任务") + '</span><span>' + estado.notas.length + " " + L("notas", "notes", "笔记") + '</span><span>' +
        estado.eventos.length + " " + L("eventos", "events", "事件") + '</span><span>' + (estado.cursos || []).length + " " + L("ramos", "courses", "门课程") + '</span></div></div>';
      if ($("#buscar-sub")) $("#buscar-sub").textContent = L("Tareas, notas, eventos, ramos y periodos.", "Tasks, notes, events, courses and terms.", "任务、笔记、事件、课程和学期。");
      return;
    }
    if ($("#buscar-sub")) $("#buscar-sub").textContent = res.length + " " + L("resultados", "results", "条结果") + ' ' + L("para ", "for ", "：") + '"' + q + '".';
    caja.innerHTML = res.length ? res.map(function (r, i) {
      return '<button class="buscar-res" type="button" data-res="' + i + '" data-tipo="' + esc(r.tipo) + '"><span class="buscar-tipo">' + esc(r.tipo) +
        '</span><span class="buscar-txt"><b>' + esc(r.titulo) + "</b><small>" + esc(r.sub) + "</small></span><span class=\"buscar-flecha\">↵</span></button>";
    }).join("") : '<div class="buscar-vacio"><b>' + esc(L("Sin resultados", "No results", "没有结果")) + '</b><p>' + esc(L("Prueba con el código del ramo, el título de la nota o el nombre de la tarea.", "Try the course code, the note title or the task name.", "试试课程代码、笔记标题或任务名称。")) + '</p></div>';
  }
  function abrirBusqueda() {
    var m = $("#modal-buscar"); if (!m) return;
    m.classList.add("on");
    $("#buscar-input").value = "";
    pintarBusqueda();
    setTimeout(function () { $("#buscar-input").focus(); }, 30);
  }
  function cerrarBusqueda() { var m = $("#modal-buscar"); if (m) m.classList.remove("on"); }
  function ejecutarBusqueda(i) {
    var fn = buscarAcciones[i];
    cerrarBusqueda();
    if (fn) fn();
  }

  function abrirModal() {
    $("#modal").classList.add("on");
    pintarCatalogo();
  }
  function cerrarModal() { $("#modal").classList.remove("on"); }
  function cerrarCapaSuperior() {
    if ($("#modal-sync-conflict").classList.contains("on")) { $("#sync-conf-cancelar").click(); return true; }
    if ($("#modal-split").classList.contains("on")) { cerrarSplitModal(); return true; }
    if ($("#modal-periodo").classList.contains("on")) { cerrarPeriodo(); return true; }
    if ($("#modal-sesion").classList.contains("on")) { cerrarSesionModal(); return true; }
    if ($("#modal").classList.contains("on")) { cerrarModal(); return true; }
    if (!$("#evento-form").hidden) { $("#evento-cancelar").click(); return true; }
    if (!$("#tarea-form").hidden) { $("#tarea-cancelar").click(); return true; }
    if (splitOn) { cerrarSplit(); return true; }
    if (document.body.classList.contains("panel-abierto")) { cerrarPanel(); return true; }
    return false;
  }
  function estaKit(id) {
    var b = BLOQUES[id];
    return b && b.tipo === "pack" && b.instala.every(instalado);
  }
  function pintarCatalogo() {
    var ids = Object.keys(BLOQUES);
    var base = ["calendario", "tareas", "notas", "ajustes"];
    var html = base.map(function (id) {
      return '<article class="bcard"><div class="bcard__nom">' + esc(nombre(id)) +
        ' <span class="pill">' + esc(L("base", "base", "基础")) + '</span></div><div class="bcard__desc">' + esc(L("Sección fija. No se quita.", "Fixed section. It cannot be removed.", "固定分区，不能移除。")) + '</div>' +
        '<div class="bcard__pie"><span>' + esc(L("base fija", "fixed base", "固定基础")) + '</span><span class="pill">' + esc(L("fija", "fixed", "固定")) + '</span></div></article>';
    }).join("");
    html += ids.filter(function (id) { return id !== "evaluaciones"; }).map(function (id) {
      var b = BLOQUES[id];
      var esta = b.tipo === "pack" ? estaKit(id) : instalado(id);
      var accion = b.tipo === "pack"
        ? '<button class="btn btn--chico ' + (esta ? "btn-peligro" : "btn-primario") + '" type="button" data-' +
          (esta ? "quitar" : "instalar") + '="' + id + '">' + (esta ? L("Quitar kit", "Remove kit", "移除套件") : L("Instalar kit", "Install kit", "安装套件")) + "</button>"
        : '<button class="btn btn--chico ' + (esta ? "btn-peligro" : "") + '" type="button" data-' +
          (esta ? "quitar" : "instalar") + '="' + id + '">' + (esta ? L("Quitar", "Remove", "移除") : L("Instalar", "Install", "安装")) + "</button>";
      return '<article class="bcard"><div class="bcard__nom">' + esc(nombre(id)) +
        ' <span class="pill">v1.0</span></div><div class="bcard__desc">' + esc(descripcionBloque(id)) +
        '</div><div class="bcard__pie"><span>' + esc(b.tipo === "pack" ? L("kit", "kit", "套件") : b.tipo) + "</span>" + accion + "</div></article>";
    }).join("");
    $("#catalogo").innerHTML = html;
    $("#modal-sub").textContent = estado.instalados.length + " " + L("bloques instalados", "blocks installed", "个模块已安装") + " · " + (ids.length + 4) + " " + L("en el catálogo", "in the catalog", "个在目录中");
    $$("#catalogo [data-instalar]").forEach(function (x) {
      x.addEventListener("click", function () { instalar(x.getAttribute("data-instalar")); });
    });
    $$("#catalogo [data-quitar]").forEach(function (x) {
      x.addEventListener("click", function () { quitar(x.getAttribute("data-quitar")); });
    });
  }
  function instalar(id) {
    var b = BLOQUES[id];
    if (!b) return;
    if (b.tipo === "pack") {
      var faltan = b.instala.filter(function (h) { return !instalado(h); });
      faltan.forEach(function (h) { estado.instalados.push(h); });
      estado.kits[id] = (estado.kits[id] || []).concat(faltan);
      aviso(faltan.length ? nombre(id) + ": " + faltan.length + " " + L("bloque(s) agregado(s).", "block(s) added.", "个模块已添加。") : nombre(id) + " " + L("ya estaba completo.", "was already complete.", "已经完整。"));
    } else if (!instalado(id)) {
      estado.instalados.push(id);
      aviso(nombre(id) + " " + L("instalado. Aparece en la barra.", "installed. It appears in the bar.", "已安装，会出现在栏中。"));
    }
    guardar(); pintarTabs(); pintarCatalogo(); pintarPanel();
    if (b.tipo === "seccion") ir(id);
  }
  function quitar(id) {
    var b = BLOQUES[id];
    if (!b) return;
    var fuera = b.tipo === "pack" ? (estado.kits[id] || []) : [id];
    estado.instalados = estado.instalados.filter(function (x) { return fuera.indexOf(x) === -1; });
    if (b.tipo === "pack") delete estado.kits[id];
    guardar(); pintarTabs(); pintarCatalogo(); pintarPanel();
    if (fuera.indexOf(pantalla) !== -1) ir("calendario");
    aviso(nombre(id) + " " + L("quitado. Tus datos se conservan.", "removed. Your data is preserved.", "已移除。你的数据保留。"));
  }

  function abrirPanel() {
    document.body.classList.remove("panel-oculto");
    document.body.classList.add("panel-abierto");
    $("#btn-panel").setAttribute("aria-expanded", "true");
  }
  function cerrarPanel() {
    document.body.classList.remove("panel-abierto");
    if (window.innerWidth > 1255) document.body.classList.add("panel-oculto");
    $("#btn-panel").setAttribute("aria-expanded", "false");
  }
  function alternarPanel() {
    if (window.innerWidth > 1255) {
      if (document.body.classList.contains("panel-oculto")) abrirPanel(); else cerrarPanel();
      return;
    }
    if (document.body.classList.contains("panel-abierto")) cerrarPanel(); else abrirPanel();
  }
  function opcionesSplit() {
    return secciones();
  }
  function seccionEl(id) {
    return document.querySelector('.seccion[data-pantalla="' + id + '"]');
  }
  function devolverSeccionSplit() {
    var esc = $("#split-escena"); if (!esc) return;
    var s = esc.querySelector(".seccion[data-pantalla]");
    if (s) {
      s.hidden = true;
      s.classList.remove("en-split");
      $("#contenido").appendChild(s);
    }
  }
  function moverSeccionSplit(id) {
    var esc = $("#split-escena"); if (!esc) return;
    var ids = opcionesSplit();
    if (!id || ids.indexOf(id) === -1 || id === pantalla) {
      id = ids.filter(function (x) { return x !== pantalla; })[0] || "tareas";
    }
    var actual = esc.querySelector(".seccion[data-pantalla]");
    if (actual && actual.getAttribute("data-pantalla") === id) {
      actual.hidden = false;
      return;
    }
    if (actual) {
      actual.hidden = true;
      actual.classList.remove("en-split");
      $("#contenido").appendChild(actual);
    }
    var s = seccionEl(id); if (!s) return;
    estado.splitSeccion = id;
    s.hidden = false;
    s.classList.add("en-split");
    esc.appendChild(s);
  }
  function pintarSplit() {
    var sel = $("#split-seccion");
    if (!sel) return;
    var ids = opcionesSplit();
    sel.innerHTML = ids.map(function (id) { return '<option value="' + id + '">' + esc(nombre(id)) + "</option>"; }).join("");
    if (ids.indexOf(estado.splitSeccion) === -1) estado.splitSeccion = ids.filter(function (x) { return x !== pantalla; })[0] || "tareas";
    if (estado.splitSeccion === pantalla) estado.splitSeccion = ids.filter(function (x) { return x !== pantalla; })[0] || "tareas";
    sel.value = estado.splitSeccion;
    if ($("#split-titulo")) $("#split-titulo").textContent = L("Ventana derecha", "Right window", "右侧窗口");
    if (splitOn) moverSeccionSplit(estado.splitSeccion);
  }
  function abrirSplit() {
    if (window.innerWidth <= 1255) { aviso(L("La vista dividida necesita al menos 1256 px.", "Split view needs at least 1256 px.", "分屏视图至少需要 1256 px。")); return; }
    splitOn = true;
    document.body.classList.add("split");
    $("#contenido-b").hidden = false;
    $("#btn-split").setAttribute("aria-pressed", "true");
    var lab = $("#lab-split"); if (lab) lab.checked = true;
    pintarSplit();
    moverSeccionSplit(estado.splitSeccion);
    mostrarPaneles();
  }
  function cerrarSplit() {
    devolverSeccionSplit();
    splitOn = false;
    document.body.classList.remove("split");
    $("#contenido-b").hidden = true;
    $("#btn-split").setAttribute("aria-pressed", "false");
    var lab = $("#lab-split"); if (lab) lab.checked = false;
    mostrarPaneles();
  }
  function alternarSplit() {
    if (splitOn) cerrarSplit(); else abrirSplitModal();
  }
  function abrirSplitModal() {
    if (window.innerWidth <= 1255) { aviso(L("La vista dividida necesita al menos 1256 px.", "Split view needs at least 1256 px.", "分屏视图至少需要 1256 px。")); return; }
    var izq = $("#split-izq"), der = $("#split-der");
    if (!izq || !der) return;
    var opciones = secciones().map(function (id) {
      return '<option value="' + id + '">' + esc(nombre(id)) + "</option>";
    }).join("");
    izq.innerHTML = opciones; der.innerHTML = opciones;
    izq.value = pantalla;
    var derecha = estado.splitSeccion;
    if (!derecha || derecha === pantalla) derecha = secciones().filter(function (id) { return id !== pantalla; })[0] || "tareas";
    der.value = derecha;
    $("#split-aviso").hidden = true;
    $("#modal-split").classList.add("on");
    izq.focus();
  }
  function cerrarSplitModal() {
    $("#modal-split").classList.remove("on");
  }
  function aplicarSplitModal() {
    var izq = $("#split-izq").value, der = $("#split-der").value;
    if (izq === der) {
      $("#split-aviso").hidden = false;
      $("#split-aviso").textContent = L("Elige dos secciones distintas para verlas al mismo tiempo.", "Choose two different sections to see them at the same time.", "选择两个不同的分区以便同时查看。");
      return;
    }
    estado.splitSeccion = der;
    guardar(); cerrarSplitModal();
    ir(izq); abrirSplit();
  }

  function quitarCarga() {
    document.body.classList.remove("cargando");
    var c = $("#carga");
    if (c) {
      c.setAttribute("aria-hidden", "true");
      setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 350);
    }
  }
  function init() {
    aplicarTema(estado.tema || "clasico");
    aplicarPrefs(); aplicarIdioma(); pintarTabs(); pintarCalendario(); pintarTemaIcono(); pintarPeriodo(); pintarSplit();
    $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-vista") === vistaTareas); });
    pintarTareas(); pintarNotas(); pintarMalla(); pintarCalificaciones(); pintarEstudio();
    pintarTemas(); pintarTiempo(); pintarPanel();
    ir(pantalla);

    $("#btn-tema").addEventListener("click", function () {
      var otro = temaModo(estado.tema) === "oscuro" ? estado.prefs.temaClaro : estado.prefs.temaOscuro;
      aplicarTema(otro || (temaModo(estado.tema) === "oscuro" ? "clasico" : "deepsea"));
    });
    $("#btn-ajustes").addEventListener("click", function () { ir("ajustes"); });
    $("#btn-panel").addEventListener("click", alternarPanel);
    $("#btn-panel-cerrar").addEventListener("click", cerrarPanel);
    $("#velo").addEventListener("click", cerrarPanel);
    $("#btn-split").addEventListener("click", alternarSplit);
    $("#btn-cerrar-split").addEventListener("click", cerrarSplit);
    $("#split-x").addEventListener("click", cerrarSplitModal);
    $("#split-cancelar").addEventListener("click", cerrarSplitModal);
    $("#split-abrir").addEventListener("click", aplicarSplitModal);
    $("#modal-split").addEventListener("click", function (e) { if (e.target === $("#modal-split")) cerrarSplitModal(); });
    $("#contenido-b").addEventListener("click", function () { splitNavHasta = Date.now() + 350; }, true);
    $("#contenido-b").addEventListener("change", function () { splitNavHasta = Date.now() + 350; }, true);
    [["#contenido", "izq"], ["#contenido-b", "der"]].forEach(function (par) {
      var zona = $(par[0]); if (!zona) return;
      zona.addEventListener("dragover", function (e) {
        if (!tabArrastrada) return;
        e.preventDefault();
        zona.classList.add("pane-soltar");
      });
      zona.addEventListener("dragleave", function (e) {
        if (!zona.contains(e.relatedTarget)) zona.classList.remove("pane-soltar");
      });
      zona.addEventListener("drop", function (e) {
        e.preventDefault(); zona.classList.remove("pane-soltar");
        if (!tabArrastrada) return;
        if (par[1] === "izq") ir(tabArrastrada);
        else {
          estado.splitSeccion = tabArrastrada; guardar();
          if (!splitOn) abrirSplit(); else pintarSplit();
        }
      });
    });
    $("#btn-add").addEventListener("click", abrirModal);
    $("#btn-catalogo-ajustes").addEventListener("click", abrirModal);
    $("#btn-periodo-ajustes").addEventListener("click", abrirPeriodo);
    ["#periodo-semanas", "#periodo-receso", "#periodo-examenes"].forEach(function (sel) {
      var el = $(sel); if (!el) return;
      el.addEventListener("input", function () { mapaPeriodo = null; regenerarMapaPeriodo(); });
    });
    $("#periodo-inicio").addEventListener("change", function () { if (mapaPeriodo) pintarMapaPeriodo(); });
    $("#pref-inicio").addEventListener("change", function (e) { estado.prefs.inicioSemana = e.target.value; guardar(); aplicarPrefs(); pintarCalendario(); });
    $("#pref-hora").addEventListener("change", function (e) { estado.prefs.hora = e.target.value; guardar(); aplicarPrefs(); pintarCalendario(); });
    $("#pref-panel-ancho").addEventListener("change", function (e) { estado.prefs.panelAncho = e.target.value; guardar(); aplicarPrefs(); });
    $("#pref-nav").addEventListener("change", function (e) { estado.prefs.navPos = e.target.value; guardar(); aplicarPrefs(); });
    $("#pref-idioma").addEventListener("change", function (e) { estado.prefs.idioma = e.target.value; guardar(); repintarIdioma(); });
    $("#pref-tema-claro").addEventListener("change", function (e) {
      estado.prefs.temaClaro = temaValido(e.target.value, "clasico");
      if (temaModo(estado.tema) === "claro") aplicarTema(estado.prefs.temaClaro, true);
      else { guardar(); pintarTemaIcono(); }
    });
    $("#pref-tema-oscuro").addEventListener("change", function (e) {
      estado.prefs.temaOscuro = temaValido(e.target.value, "deepsea");
      if (temaModo(estado.tema) === "oscuro") aplicarTema(estado.prefs.temaOscuro, true);
      else { guardar(); pintarTemaIcono(); }
    });
    $("#pref-notif").addEventListener("change", function (e) {
      estado.prefs.notificaciones = e.target.checked; guardar();
      if (e.target.checked && typeof Notification !== "undefined" && Notification.permission === "default") {
        try { Notification.requestPermission(); } catch (_) {}
      }
    });
    $("#pref-panel-abierto").addEventListener("change", function (e) { estado.prefs.panelAbierto = e.target.checked; guardar(); if (e.target.checked) abrirPanel(); else cerrarPanel(); });
    $("#lab-split").addEventListener("change", function (e) {
      if (e.target.checked) abrirSplitModal();
      else cerrarSplit();
      pintarAjustes();
    });
    $("#btn-exportar").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mimo-backup.json"; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      aviso(L("Respaldo exportado.", "Backup exported.", "备份已导出。"));
    });
    $("#btn-importar").addEventListener("click", function () { $("#archivo-importar").click(); });
    $("#archivo-importar").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var lector = new FileReader();
      lector.onload = function () {
        try {
          var x = JSON.parse(lector.result);
          var nuevo = null, origen = "";
          if (x && x.formato === 2 && x.estado && typeof x.estado === "object") {
            nuevo = convertirAcademics(x); origen = "Mimo Academics";
          } else if (x && typeof x === "object" && !Array.isArray(x)) {
            nuevo = x; origen = "MIMO";
          }
          if (!nuevo) { aviso(L("Ese archivo no es un respaldo de MIMO.", "That file is not a MIMO backup.", "该文件不是 MIMO 备份。")); return; }
          if (!window.confirm(L("Se reemplazarán los datos actuales por los de " + origen + ". ¿Continuar?", "Current data will be replaced by " + origen + ". Continue?", "当前数据将被 " + origen + " 替换。继续？"))) return;
          reemplazarEstado(nuevo);
          aviso(L("Importados ", "Imported ", "已导入 ") + estado.cursos.length + L(" ramos, ", " courses, ", " 门课程、") + estado.tareas.length + L(" tareas y ", " tasks and ", " 个任务和 ") + estado.sesiones.length + L(" sesiones.", " sessions.", " 个会话。"));
        } catch (err) { aviso(L("No se pudo importar el archivo.", "The file could not be imported.", "无法导入文件。")); }
      };
      lector.readAsText(f); e.target.value = "";
    });
    $("#btn-panel-ajustes").addEventListener("click", abrirPanel);
    $("#pie-panel").addEventListener("click", alternarPanel);
    $("#pie-sync").addEventListener("click", function () { aviso(L("Guardado en este equipo. El respaldo es un archivo .json.", "Saved on this device. The backup is a .json file.", "已保存到本设备。备份是一个 .json 文件。")); });
    $("#pie-ayuda").addEventListener("click", function () { aviso(L("Clic derecho en una nota, tarea, evento, periodo o sesión para abrir sus acciones y borrar. También Shift+F10.", "Right-click a note, task, event, term or session to open its actions and delete. Shift+F10 also works.", "右键点击笔记、任务、事件、学期或会话可打开操作并删除。也可按 Shift+F10。")); });
    $("#modal-x").addEventListener("click", cerrarModal);
    $("#modal").addEventListener("click", function (e) { if (e.target === $("#modal")) cerrarModal(); });

    $("#menu-ctx").addEventListener("click", function (e) {
      var b = e.target.closest("[data-accion]");
      if (!b) return;
      e.stopPropagation();
      var fn = menuAcciones[b.getAttribute("data-accion")];
      cerrarMenu();
      if (fn) fn();
    });
    $("#menu-ctx").addEventListener("contextmenu", function (e) { e.preventDefault(); });
    $("#menu-ctx").addEventListener("keydown", function (e) {
      var bs = $$("#menu-ctx button");
      if (!bs.length) return;
      var i = bs.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); bs[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); bs[bs.length - 1].focus(); }
    });
    document.addEventListener("contextmenu", function (e) {
      if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      var ctx = menuDeContexto(e.target);
      if (!ctx) return;
      e.preventDefault();
      abrirMenu(e.clientX, e.clientY, ctx.titulo, ctx.items);
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#menu-ctx")) cerrarMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
      if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      var el = e.target.closest("[data-nota],[data-evento],[data-tarea],[data-periodo-item],[data-sesion],[data-cal-dia],[data-ctx-zona]");
      if (!el) return;
      e.preventDefault();
      menuPorTeclado(el);
    });
    window.addEventListener("scroll", cerrarMenu, true);
    window.addEventListener("resize", cerrarMenu);
    $$(".panel__tab").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.panel[pantalla] = b.getAttribute("data-ptab");
        guardar(); pintarPanel();
      });
    });
    $$("#vista-tareas button").forEach(function (b) {
      b.addEventListener("click", function () {
        vistaTareas = b.getAttribute("data-vista");
        estado.vistaTareas = vistaTareas;
        $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x === b); });
        guardar(); pintarTareas();
      });
    });
    $("#btn-nueva-tarea").addEventListener("click", function () { abrirFormulario(null); });
    $("#tareas-crear").addEventListener("click", function () { abrirFormulario(null); });
    $("#tarea-cancelar").addEventListener("click", function () { $("#tarea-form").hidden = true; });
    $("#tarea-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var titulo = $("#tarea-titulo").value.trim();
      if (!titulo) return;
      var tipo = $("#tarea-tipo").value === "proyecto" ? "proyecto" : "tarea";
      var padre = $("#tarea-padre").value || null;
      var t;
      if (formEditId) {
        t = tareaPorId(formEditId);
        if (!t) return;
      } else {
        t = { id: "t" + Date.now(), creada: new Date().toISOString(), orden: estado.tareas.length };
        estado.tareas.push(t);
      }
      if (padre === t.id) padre = null;
      t.titulo = titulo;
      t.tipo = tipo;
      t.padre_id = padre;
      t.fecha = $("#tarea-fecha").value || "";
      t.prioridad = $("#tarea-prioridad").value;
      t.contexto = $("#tarea-contexto").value.trim();
      t.nota = t.nota || "";
      if (!t.estado) { t.estado = "pendiente"; t.hecha = false; }
      estado.tareaSel = t.id;
      estado.panel[ctxDe($("#tarea-form"))] = "detalle";
      $("#tarea-form").hidden = true;
      formEditId = null;
      if (vistaTareas === "hoy") {
        vistaTareas = "arbol";
        estado.vistaTareas = "arbol";
        $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-vista") === "arbol"); });
      }
      guardar(); pintarTareas(); pintarPanel();
      aviso(tipo === "proyecto" ? "Proyecto creado. Añade tareas dentro." : "Tarea creada.");
    });
    $("#btn-nuevo-ramo").addEventListener("click", function () { abrirFormularioRamo(null); });
    $("#malla-crear").addEventListener("click", function () { abrirFormularioRamo(null); });
    $("#ramo-cancelar").addEventListener("click", cerrarFormularioRamo);
    $("#btn-importar-malla").addEventListener("click", function () { $("#archivo-malla").click(); });
    $("#malla-importar-vacio").addEventListener("click", function () { $("#archivo-malla").click(); });
    $("#btn-exportar-malla").addEventListener("click", exportarMalla);
    $("#archivo-malla").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      importarMalla(f); e.target.value = "";
    });
    $("#malla-buscar").addEventListener("input", function (e) { mallaBusqueda = e.target.value; pintarMalla(); });
    $("#malla-filtro").addEventListener("change", function (e) { mallaFiltro = e.target.value; pintarMalla(); });
    $("#malla-rapido").addEventListener("change", function (e) { mallaRapido = e.target.checked; });
    $("#malla-quitar-sel").addEventListener("click", limpiarSeleccionMalla);
    $("#btn-calif-malla").addEventListener("click", function () { ir("malla"); });
    $("#btn-estudio-malla").addEventListener("click", function () { ir("malla"); });
    $("#est-form").addEventListener("submit", function (e) {
      e.preventDefault();
      normalizarEstudio();
      var fecha = $("#est-fecha").value || hoyISO();
      var minutos = Math.min(1440, parseDuracion($("#est-minutos").value));
      if (!minutos) { aviso(L("Escribe una duración: 90, 1:30 o 2:30:21.", "Enter a duration: 90, 1:30 or 2:30:21.", "输入时长：90、1:30 或 2:30:21。")); return; }
      estado.sesiones.push({
        id: "s" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        fecha: fecha, hora: "", minutos: minutos, ramo: $("#est-ramo").value || "", vinculo: "", tipo: "manual"
      });
      guardar(); pintarEstudio(); pintarTiempo();
      aviso(L("Sesión de ", "Session of ", "会话 ") + fmtDuracion(minutos) + L(" registrada.", " logged.", " 已记录。"));
    });
    $("#est-meta").addEventListener("change", function (e) {
      normalizarEstudio(); estado.estudio.metaSemanal = Math.max(0, Number(e.target.value) || 0);
      guardar(); pintarEstudio();
    });
    $("#est-tabla").addEventListener("change", function (e) {
      var el = e.target.closest("[data-est-meta-ramo]"); if (!el) return;
      normalizarEstudio();
      estado.estudio.metasRamo[el.getAttribute("data-est-meta-ramo")] = Math.max(0, Number(el.value) || 0);
      guardar(); pintarEstudio();
    });
    $("#est-metas-semana").addEventListener("change", function (e) {
      var el = e.target.closest("[data-est-meta-semana]"); if (!el) return;
      normalizarEstudio();
      estado.estudio.metasSemana[el.getAttribute("data-est-meta-semana")] = Math.max(0, Number(el.value) || 0);
      guardar(); pintarEstudio();
    });
    $("#est-sesiones").addEventListener("click", function (e) {
      var be = e.target.closest("[data-editar-estudio]");
      if (be) { abrirSesionModal(be.getAttribute("data-editar-estudio")); return; }
      var b = e.target.closest("[data-borrar-estudio]"); if (!b) return;
      borrarSesion(b.getAttribute("data-borrar-estudio"));
    });
    $("#calif-crear-ramo").addEventListener("click", function () { ir("malla"); abrirFormularioRamo(null); });
    $("#calif-lista").addEventListener("click", function (e) {
      var b = e.target.closest("[data-calif]"); if (!b) return;
      califSel = b.getAttribute("data-calif"); estado.califSel = califSel;
      estado.ramoSel = califSel; estado.panel.calificaciones = "detalle";
      guardar(); pintarCalificaciones(); pintarPanel();
      if (window.innerWidth <= 1255) abrirPanel();
    });
    $("#calif-detalle").addEventListener("change", cambioCalif);
    $("#calif-detalle").addEventListener("click", accionCalif);

    $("#ramo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var cod = $("#ramo-codigo").value.trim().toUpperCase();
      var nombre = $("#ramo-nombre").value.trim();
      if (!cod || !nombre) { aviso(L("Código y nombre son obligatorios.", "Code and name are required.", "代码和名称为必填项。")); return; }
      normalizarCursos();
      var original = formRamoId ? ramoPorCodigo(formRamoId) : null;
      var choque = ramoPorCodigo(cod);
      if (choque && (!original || choque.codigo !== original.codigo)) { aviso(L("Ese código ya existe.", "That code already exists.", "该代码已存在。")); return; }
      var reqs = $("#ramo-requisitos").value.split(/[,;]+/).map(function (r) {
        return r.trim().toUpperCase();
      }).filter(function (r) { return r && r !== cod; });
      reqs = reqs.filter(function (r, i) { return reqs.indexOf(r) === i; });
      if (original && original.codigo !== cod) {
        var viejo = original.codigo;
        estado.cursos.forEach(function (x) {
          x.requisitos = x.requisitos.map(function (r) { return r === viejo ? cod : r; });
          x.requisitos_o = (x.requisitos_o || []).map(function (g) {
            return g.map(function (r) { return r === viejo ? cod : r; });
          });
        });
        if (estado.ramoSel === viejo) estado.ramoSel = cod;
        if (estado.califSel === viejo) estado.califSel = cod;
        if (estado.califs && estado.califs[viejo]) { estado.califs[cod] = estado.califs[viejo]; delete estado.califs[viejo]; }
        original.codigo = cod;
      }
      var c = original || { codigo: cod };
      c.nombre = nombre;
      c.creditos = Math.max(0, parseInt($("#ramo-creditos").value, 10) || 0);
      c.nivel = Math.max(1, Math.min(99, parseInt($("#ramo-nivel").value, 10) || 1));
      c.requisitos = reqs;
      c.requisitos_o = c.requisitos_o || [];
      var aprobado = $("#ramo-aprobado").checked;
      var enCurso = $("#ramo-curso").checked && !aprobado;
      var cerrado = aprobado || (!!original && original.cerrado && !original.aprobado && !enCurso);
      c.cerrado = cerrado;
      c.aprobado = cerrado && aprobado;
      c.resultado = cerrado ? (c.aprobado ? "aprobado" : "reprobado") : "";
      c.notaCierre = cerrado ? (original ? original.notaCierre : null) : null;
      c.cerradoEn = cerrado ? (original && original.cerradoEn ? original.cerradoEn : selloLocal()) : "";
      c.enCurso = enCurso;
      if (!original) estado.cursos.push(c);
      estado.ramoSel = c.codigo; estado.panel.malla = "detalle";
      guardar(); cerrarFormularioRamo(); pintarMalla(); pintarPanel();
      aviso(original ? "Ramo guardado." : "Ramo creado.");
    });

    $("#btn-nueva-nota").addEventListener("click", crearNota);
    $("#btn-borrar-nota").addEventListener("click", function () {
      if (estado.notaSel) borrarNota(estado.notaSel);
    });
    $("#buscar-nota").addEventListener("input", function (e) {
      notaBusqueda = e.target.value; pintarNotasLista("#notas-items", true);
    });
    $("#nota-titulo").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.titulo = e.target.value;
      n.actualizado = selloLocal();
      guardar();
    });
    $("#nota-titulo").addEventListener("change", function () {
      pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-cuerpo").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.cuerpo = e.target.value;
      n.actualizado = selloLocal();
      guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-modo").addEventListener("click", function () { notaModo = notaModo === "preview" ? "editar" : "preview"; pintarNotas(); });
    $("#nota-fijar").addEventListener("click", function () {
      var n = notaActual(); if (!n) return;
      n.fijada = !n.fijada; guardar(); pintarNotas(); pintarPanel();
    });
    $("#nota-contexto").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return; n.contexto = e.target.value; guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-etiquetas").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.etiquetas = e.target.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-vinculo").addEventListener("change", function (e) {
      var n = notaActual(); if (!n) return;
      var v = e.target.value, tipo = v.split(":")[0], id = v.split(":")[1];
      if (!v) { n.enlaces = []; }
      else {
        var titulo = "";
        if (tipo === "tarea") { var t = tareaPorId(id); titulo = t ? t.titulo : ""; }
        else { var ev = eventoPorId(id); titulo = ev ? ev.titulo : ""; }
        n.enlaces = [{ tipo: tipo, id: id, titulo: titulo }];
      }
      guardar(); pintarNotas(); pintarPanel();
    });
    $("#btn-hoy").addEventListener("click", function () { calCursor = new Date(); pintarCalendario(); });
    $("#btn-periodo").addEventListener("click", abrirPeriodo);
    $("#sesion-x").addEventListener("click", cerrarSesionModal);
    $("#sesion-cancelar").addEventListener("click", cerrarSesionModal);
    $("#modal-sesion").addEventListener("click", function (e) { if (e.target === $("#modal-sesion")) cerrarSesionModal(); });
    $("#sesion-form").addEventListener("submit", guardarSesionModal);
    $("#sesion-borrar").addEventListener("click", function () {
      var id = $("#sesion-id").value; cerrarSesionModal(); borrarSesion(id);
    });
    $("#periodo-x").addEventListener("click", cerrarPeriodo);
    $("#periodo-cancelar").addEventListener("click", cerrarPeriodo);
    $("#modal-periodo").addEventListener("click", function (e) { if (e.target === $("#modal-periodo")) cerrarPeriodo(); });
    $("#periodo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nombre = $("#periodo-nombre").value.trim(); if (!nombre) return;
      var inicio = $("#periodo-inicio").value || hoyISO();
      var total = Math.max(1, parseInt($("#periodo-semanas").value, 10) || 18);
      if (!mapaPeriodo || mapaPeriodo.length !== total) regenerarMapaPeriodo();
      var semanas = [], base = new Date(inicio + "T12:00:00"), clases = 0, receso = 0, exam = 0;
      for (var i = 0; i < total; i++) {
        var d = new Date(base.getTime()); d.setDate(d.getDate() + i * 7);
        var fin = new Date(d.getTime()); fin.setDate(fin.getDate() + 6);
        var tipo = (mapaPeriodo[i] && mapaPeriodo[i].tipo) || "clases";
        if (tipo === "receso") receso++; else if (tipo === "examenes") exam++; else { tipo = "clases"; clases++; }
        semanas.push({ n: i + 1, desde: isoDeFecha(d), hasta: isoDeFecha(fin), tipo: tipo });
      }
      var existente = formPeriodoId ? (estado.periodos || []).filter(function (x) { return x.id === formPeriodoId; })[0] : null;
      var p = existente || { id: "p" + Date.now(), nombre: nombre, inicio: inicio, semanas: semanas };
      p.nombre = nombre; p.inicio = inicio; p.semanas = semanas;
      if (existente) {
        guardar(); pintarPeriodo(); cerrarPeriodo();
        aviso(L("Periodo guardado: ", "Term saved: ", "学期已保存：") + clases + L(" clases, ", " classes, ", " 节课程、") + receso + L(" receso, ", " break, ", " 周假期、") + exam + L(" exámenes.", " exams.", " 周考试。"));
      } else {
        estado.periodos = estado.periodos || []; estado.periodos.push(p); estado.periodoActivo = p.id;
        guardar(); pintarPeriodo(); cerrarPeriodo(); $("#periodo-nombre").value = "";
        aviso(L("Periodo creado: ", "Term created: ", "学期已创建：") + clases + L(" clases, ", " classes, ", " 节课程、") + receso + L(" receso, ", " break, ", " 周假期、") + exam + L(" exámenes.", " exams.", " 周考试。"));
      }
    });
    $("#split-seccion").addEventListener("change", function (e) {
      if (e.target.value === pantalla) {
        aviso(L("Esa sección ya está en la ventana izquierda.", "That section is already in the left window.", "该分区已在左侧窗口。"));
        e.target.value = estado.splitSeccion;
        return;
      }
      estado.splitSeccion = e.target.value; guardar(); pintarSplit();
    });
    $("#btn-empezar").addEventListener("click", empezarTiempo);
    $("#btn-pausar").addEventListener("click", pausarTiempo);
    $("#btn-parar").addEventListener("click", pararTiempo);
    $("#btn-reiniciar").addEventListener("click", reiniciarTiempo);
    $("#btn-buscar").addEventListener("click", abrirBusqueda);
    $("#buscar-x").addEventListener("click", cerrarBusqueda);
    $("#modal-buscar").addEventListener("click", function (e) { if (e.target === $("#modal-buscar")) cerrarBusqueda(); });
    $("#buscar-input").addEventListener("input", pintarBusqueda);
    $("#buscar-resultados").addEventListener("click", function (e) {
      var b = e.target.closest("[data-res]"); if (!b) return;
      ejecutarBusqueda(parseInt(b.getAttribute("data-res"), 10));
    });
    $("#buscar-input").addEventListener("keydown", function (e) {
      var bs = $$("#buscar-resultados [data-res]");
      if (e.key === "Escape") { e.preventDefault(); cerrarBusqueda(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!bs.length) return;
        var i = bs.indexOf(document.activeElement);
        if (e.key === "ArrowDown") bs[(i + 1) % bs.length].focus();
        else bs[(i - 1 + bs.length) % bs.length].focus();
      } else if (e.key === "Enter" && bs.length) {
        e.preventDefault(); ejecutarBusqueda(parseInt(bs[0].getAttribute("data-res"), 10));
      }
    });
    $("#btn-nuevo").addEventListener("click", abrirPeriodo);
    $("#btn-nuevo-evento").addEventListener("click", function () { abrirEvento(null); });
    $("#evento-cancelar").addEventListener("click", function () { $("#evento-form").hidden = true; });
    $("#evento-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var titulo = $("#evento-titulo").value.trim();
      if (!titulo) return;
      var ev = formEventoId ? eventoPorId(formEventoId) : null;
      if (!ev) {
        ev = { id: "e" + Date.now() };
        estado.eventos.push(ev);
      }
      ev.titulo = titulo;
      ev.fecha = $("#evento-fecha").value || hoyISO();
      ev.hora = $("#evento-hora").value;
      ev.contexto = $("#evento-contexto").value.trim();
      ev.nota = ev.nota || "";
      estado.eventoSel = ev.id;
      estado.panel[ctxDe($("#evento-form"))] = "detalle";
      $("#evento-form").hidden = true;
      formEventoId = null;
      guardar(); pintarCalendario(); pintarPanel();
      aviso(L("Evento guardado.", "Event saved.", "事件已保存。"));
    });
    $$("#vista-calendario button").forEach(function (b) {
      b.addEventListener("click", function () {
        vistaCalendario = b.getAttribute("data-cal-vista");
        estado.vistaCalendario = vistaCalendario;
        guardar(); pintarCalendario();
      });
    });
    $("#cal-ant").addEventListener("click", function () {
      if (vistaCalendario === "semana") calCursor.setDate(calCursor.getDate() - 7);
      else calCursor.setMonth(calCursor.getMonth() - 1);
      pintarCalendario();
    });
    $("#cal-sig").addEventListener("click", function () {
      if (vistaCalendario === "semana") calCursor.setDate(calCursor.getDate() + 7);
      else calCursor.setMonth(calCursor.getMonth() + 1);
      pintarCalendario();
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); abrirBusqueda();
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        var orden = secciones(), indice = parseInt(e.key, 10) - 1;
        if (orden[indice]) { e.preventDefault(); ir(orden[indice]); }
        return;
      }
      if (e.key === "Escape") {
        if ($("#modal-buscar").classList.contains("on")) { e.preventDefault(); cerrarBusqueda(); return; }
        if (!$("#menu-ctx").hidden) { e.preventDefault(); cerrarMenu(); return; }
        if (cerrarCapaSuperior()) { e.preventDefault(); return; }
        cerrarModal(); cerrarPanel();
      }
    });
    setInterval(comprobarAlarmas, 1000);
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1255) document.body.classList.remove("panel-abierto");
      else document.body.classList.remove("panel-oculto");
      if (window.innerWidth <= 1255 && splitOn) {
        splitOn = false;
        document.body.classList.remove("split");
        $("#contenido-b").hidden = true;
        $("#btn-split").setAttribute("aria-pressed", "false");
      }
      if (pantalla === "malla") setTimeout(dibujarLineasMalla, 60);
    });
    guardar();
    setTimeout(quitarCarga, 30);
  }

  window.MimoI18n = { L: L, idioma: idioma, t: t };

  window.MimoHost = {
    snapshot: function () { return JSON.parse(JSON.stringify(estado)); },
    reemplazar: reemplazarEstado,
    resumen: function () { return resumenEstado(estado); },
    tieneDatos: function () { return estadoTieneDatos(estado); },
    aviso: aviso,
    ir: ir,
    guardar: guardar
  };

  setTimeout(function () {
    if (document.body.classList.contains("cargando")) quitarCarga();
  }, 5000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
