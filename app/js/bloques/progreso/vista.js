/* vista.js — HTML del bloque Progreso. Se monta en su host; no vive en index.html. */
(function () {
  "use strict";
  window.MimoBloqueProgresoVista = `
  <div class="sec-cab">
    <div>
      <h1 data-i18n="nav.progreso">Progreso</h1>
      <p class="sec-sub" data-i18n="sub.progreso">Metas, registros y gráficos. Tú decides qué medir, cada cuánto y hasta dónde.</p>
    </div>
    <div class="sec-acciones">
      <button class="btn" id="prog-nueva-cat" type="button" data-l10n-es="+ Categoría" data-l10n-en="+ Category" data-l10n-zh="+ 分类">+ Categoría</button>
      <button class="btn" id="prog-archivadas" type="button" data-l10n-es="Archivadas" data-l10n-en="Archived" data-l10n-zh="已归档">Archivadas</button>
      <button class="btn btn-primario" id="prog-nueva" type="button" data-l10n-es="+ Nueva meta" data-l10n-en="+ New goal" data-l10n-zh="+ 新目标">+ Nueva meta</button>
    </div>
  </div>

  <div class="kpis" id="prog-kpis"></div>
  <div class="prog-grupos" id="prog-grupos"></div>
  <div class="prog-vacio" id="prog-vacio" hidden>
    <h2 data-l10n-es="Sin metas todavía" data-l10n-en="No goals yet" data-l10n-zh="还没有目标">Sin metas todavía</h2>
    <p data-l10n-es="Crea una meta y registra el primer valor. Puede ser diaria, semanal o de una sola vez." data-l10n-en="Create a goal and log the first value. It can be daily, weekly or one-off." data-l10n-zh="创建一个目标并记录第一个值。可以是每日、每周或一次性。">Crea una meta y registra el primer valor. Puede ser diaria, semanal o de una sola vez.</p>
    <button class="btn btn-primario" type="button" id="prog-vacio-nueva" data-l10n-es="Crear la primera meta" data-l10n-en="Create the first goal" data-l10n-zh="创建第一个目标">Crear la primera meta</button>
  </div>

  <div class="prog-modal" id="prog-modal-cat" hidden>
    <div class="prog-modal__caja" role="dialog" aria-modal="true" aria-labelledby="prog-cat-tit">
      <div class="prog-modal__cab">
        <div>
          <h2 id="prog-cat-tit">Categoría</h2>
          <small data-l10n-es="Nombre, icono y color. Las metas se mueven con ella." data-l10n-en="Name, icon and colour. Goals move with it." data-l10n-zh="名称、图标和颜色。目标随分类移动。">Nombre, icono y color. Las metas se mueven con ella.</small>
        </div>
        <button class="icono-btn" type="button" data-prog-cerrar="prog-modal-cat" aria-label="Cerrar">×</button>
      </div>
      <div class="prog-campos">
        <label class="todo"><span data-l10n-es="Nombre" data-l10n-en="Name" data-l10n-zh="名称">Nombre</span>
          <input id="prog-cat-nombre" type="text" maxlength="40" placeholder="Salud, Estudio, Fuerza…"></label>
        <label><span data-l10n-es="Icono" data-l10n-en="Icon" data-l10n-zh="图标">Icono</span>
          <select id="prog-cat-icono">
            <option value="diana" data-l10n-es="Diana" data-l10n-en="Target" data-l10n-zh="靶心">Diana</option>
            <option value="agua" data-l10n-es="Gota" data-l10n-en="Drop" data-l10n-zh="水滴">Gota</option>
            <option value="libro" data-l10n-es="Libro" data-l10n-en="Book" data-l10n-zh="书">Libro</option>
            <option value="pesa" data-l10n-es="Pesa" data-l10n-en="Weight" data-l10n-zh="哑铃">Pesa</option>
            <option value="estudio" data-l10n-es="Estudio" data-l10n-en="Study" data-l10n-zh="学习">Estudio</option>
            <option value="peso" data-l10n-es="Balanza" data-l10n-en="Scale" data-l10n-zh="秤">Balanza</option>
            <option value="corazon" data-l10n-es="Corazón" data-l10n-en="Heart" data-l10n-zh="心">Corazón</option>
            <option value="dinero" data-l10n-es="Dinero" data-l10n-en="Money" data-l10n-zh="钱">Dinero</option>
            <option value="otro" data-l10n-es="Otro" data-l10n-en="Other" data-l10n-zh="其他">Otro</option>
          </select></label>
        <label><span data-l10n-es="Color" data-l10n-en="Colour" data-l10n-zh="颜色">Color</span>
          <select id="prog-cat-tono">
            <option value="ac" data-l10n-es="Azul" data-l10n-en="Blue" data-l10n-zh="蓝色">Azul</option>
            <option value="ok" data-l10n-es="Verde" data-l10n-en="Green" data-l10n-zh="绿色">Verde</option>
            <option value="warn" data-l10n-es="Ámbar" data-l10n-en="Amber" data-l10n-zh="琥珀">Ámbar</option>
            <option value="q" data-l10n-es="Violeta" data-l10n-en="Violet" data-l10n-zh="紫色">Violeta</option>
            <option value="bad" data-l10n-es="Rojo" data-l10n-en="Red" data-l10n-zh="红色">Rojo</option>
          </select></label>
        <p class="prog-ayuda" data-l10n-es="Al eliminar una categoría, sus metas pasan a General. No se borra ninguna meta." data-l10n-en="Deleting a category moves its goals to General. No goal is deleted." data-l10n-zh="删除分类会把目标移到“通用”，不会删除目标。">Al eliminar una categoría, sus metas pasan a General. No se borra ninguna meta.</p>
      </div>
      <div class="prog-modal__pie">
        <button class="btn btn-peligro" type="button" id="prog-cat-eliminar" hidden data-l10n-es="Eliminar" data-l10n-en="Delete" data-l10n-zh="删除">Eliminar</button>
        <span class="crece"></span>
        <button class="btn" type="button" data-prog-cerrar="prog-modal-cat" data-l10n-es="Cancelar" data-l10n-en="Cancel" data-l10n-zh="取消">Cancelar</button>
        <button class="btn btn-primario" type="button" id="prog-cat-guardar" data-l10n-es="Guardar" data-l10n-en="Save" data-l10n-zh="保存">Guardar</button>
      </div>
    </div>
  </div>

  <div class="prog-modal" id="prog-modal-meta" hidden>
    <div class="prog-modal__caja" role="dialog" aria-modal="true" aria-labelledby="prog-modal-tit">
      <div class="prog-modal__cab">
        <div>
          <h2 id="prog-modal-tit">Nueva meta</h2>
          <small data-l10n-es="Todo se puede cambiar después." data-l10n-en="Everything can be changed later." data-l10n-zh="之后都可以更改。">Todo se puede cambiar después.</small>
        </div>
        <button class="icono-btn" type="button" data-prog-cerrar="prog-modal-meta" aria-label="Cerrar">×</button>
      </div>
      <div class="prog-campos">
        <label class="todo"><span data-l10n-es="Nombre" data-l10n-en="Name" data-l10n-zh="名称">Nombre</span>
          <input id="prog-f-nombre" type="text" maxlength="60" placeholder="Agua, Leer, Press banca…"></label>
        <label><span data-l10n-es="Unidad" data-l10n-en="Unit" data-l10n-zh="单位">Unidad</span>
          <input id="prog-f-unidad" type="text" maxlength="12" placeholder="L, kg, h, libros"></label>
        <label><span data-l10n-es="Objetivo" data-l10n-en="Target" data-l10n-zh="目标">Objetivo</span>
          <input id="prog-f-objetivo" type="number" step="any" min="0.0001"></label>
        <label><span data-l10n-es="Tipo" data-l10n-en="Type" data-l10n-zh="类型">Tipo</span>
          <select id="prog-f-tipo">
            <option value="suma" data-l10n-es="Suma del período" data-l10n-en="Sum over the period" data-l10n-zh="期间累加">Suma del período</option>
            <option value="ultimo" data-l10n-es="Último valor" data-l10n-en="Latest value" data-l10n-zh="最新值">Último valor</option>
            <option value="mejor" data-l10n-es="Mejor marca" data-l10n-en="Best record" data-l10n-zh="最佳记录">Mejor marca</option>
            <option value="conteo" data-l10n-es="Conteo" data-l10n-en="Count" data-l10n-zh="计数">Conteo</option>
          </select></label>
        <label><span data-l10n-es="Sentido" data-l10n-en="Direction" data-l10n-zh="方向">Sentido</span>
          <select id="prog-f-sentido">
            <option value="subir" data-l10n-es="Subir (mínimo)" data-l10n-en="Rise (minimum)" data-l10n-zh="上升（最低）">Subir (mínimo)</option>
            <option value="bajar" data-l10n-es="Bajar (máximo o techo)" data-l10n-en="Fall (maximum or cap)" data-l10n-zh="下降（最高或上限）">Bajar (máximo o techo)</option>
          </select></label>
        <label><span data-l10n-es="Período" data-l10n-en="Period" data-l10n-zh="周期">Período</span>
          <select id="prog-f-periodo">
            <option value="dia" data-l10n-es="Cada día" data-l10n-en="Every day" data-l10n-zh="每天">Cada día</option>
            <option value="semana" data-l10n-es="Cada semana" data-l10n-en="Every week" data-l10n-zh="每周">Cada semana</option>
            <option value="mes" data-l10n-es="Cada mes" data-l10n-en="Every month" data-l10n-zh="每月">Cada mes</option>
            <option value="anio" data-l10n-es="Cada año" data-l10n-en="Every year" data-l10n-zh="每年">Cada año</option>
            <option value="unica" data-l10n-es="Meta única" data-l10n-en="One-off goal" data-l10n-zh="一次性目标">Meta única</option>
          </select></label>
        <label><span data-l10n-es="Paso" data-l10n-en="Step" data-l10n-zh="步长">Paso</span>
          <input id="prog-f-paso" type="number" step="any" min="0.0001"></label>
        <label><span data-l10n-es="Valor inicial (opcional)" data-l10n-en="Starting value (optional)" data-l10n-zh="起始值（可选）">Valor inicial (opcional)</span>
          <input id="prog-f-inicio" type="number" step="any" placeholder="Para medir el avance"></label>
        <label><span data-l10n-es="Decimales" data-l10n-en="Decimals" data-l10n-zh="小数位">Decimales</span>
          <select id="prog-f-decimales"><option value="0">0</option><option value="1">1</option><option value="2">2</option></select></label>
        <label><span data-l10n-es="Color" data-l10n-en="Colour" data-l10n-zh="颜色">Color</span>
          <select id="prog-f-tono">
            <option value="ac" data-l10n-es="Azul" data-l10n-en="Blue" data-l10n-zh="蓝色">Azul</option>
            <option value="ok" data-l10n-es="Verde" data-l10n-en="Green" data-l10n-zh="绿色">Verde</option>
            <option value="warn" data-l10n-es="Ámbar" data-l10n-en="Amber" data-l10n-zh="琥珀">Ámbar</option>
            <option value="q" data-l10n-es="Violeta" data-l10n-en="Violet" data-l10n-zh="紫色">Violeta</option>
            <option value="bad" data-l10n-es="Rojo" data-l10n-en="Red" data-l10n-zh="红色">Rojo</option>
          </select></label>
        <label><span data-l10n-es="Icono" data-l10n-en="Icon" data-l10n-zh="图标">Icono</span>
          <select id="prog-f-icono">
            <option value="diana" data-l10n-es="Diana" data-l10n-en="Target" data-l10n-zh="靶心">Diana</option>
            <option value="agua" data-l10n-es="Gota" data-l10n-en="Drop" data-l10n-zh="水滴">Gota</option>
            <option value="libro" data-l10n-es="Libro" data-l10n-en="Book" data-l10n-zh="书">Libro</option>
            <option value="pesa" data-l10n-es="Pesa" data-l10n-en="Weight" data-l10n-zh="哑铃">Pesa</option>
            <option value="estudio" data-l10n-es="Estudio" data-l10n-en="Study" data-l10n-zh="学习">Estudio</option>
            <option value="peso" data-l10n-es="Balanza" data-l10n-en="Scale" data-l10n-zh="秤">Balanza</option>
            <option value="corazon" data-l10n-es="Corazón" data-l10n-en="Heart" data-l10n-zh="心">Corazón</option>
            <option value="dinero" data-l10n-es="Dinero" data-l10n-en="Money" data-l10n-zh="钱">Dinero</option>
            <option value="otro" data-l10n-es="Otro" data-l10n-en="Other" data-l10n-zh="其他">Otro</option>
          </select></label>
        <label><span data-l10n-es="Fuente" data-l10n-en="Source" data-l10n-zh="来源">Fuente</span>
          <select id="prog-f-fuente">
            <option value="manual" data-l10n-es="Manual" data-l10n-en="Manual" data-l10n-zh="手动">Manual</option>
            <option value="sesiones" data-l10n-es="Sesiones de Estudio" data-l10n-en="Study sessions" data-l10n-zh="学习时段">Sesiones de Estudio</option>
          </select></label>
        <label><span data-l10n-es="Categoría" data-l10n-en="Category" data-l10n-zh="分类">Categoría</span>
          <select id="prog-f-categoria"></select></label>
        <label class="todo"><span data-l10n-es="Vincular a una tarea" data-l10n-en="Link to a task" data-l10n-zh="关联任务">Vincular a una tarea</span>
          <select id="prog-f-tarea"><option value="">—</option></select></label>
        <p class="prog-ayuda" id="prog-ayuda"></p>
      </div>
      <div class="prog-modal__pie">
        <button class="btn" type="button" id="prog-archivar" hidden data-l10n-es="Archivar" data-l10n-en="Archive" data-l10n-zh="归档">Archivar</button>
        <button class="btn" type="button" id="prog-duplicar" hidden data-l10n-es="Duplicar" data-l10n-en="Duplicate" data-l10n-zh="复制">Duplicar</button>
        <button class="btn btn-peligro" type="button" id="prog-eliminar" hidden data-l10n-es="Eliminar" data-l10n-en="Delete" data-l10n-zh="删除">Eliminar</button>
        <span class="crece"></span>
        <button class="btn" type="button" data-prog-cerrar="prog-modal-meta" data-l10n-es="Cancelar" data-l10n-en="Cancel" data-l10n-zh="取消">Cancelar</button>
        <button class="btn btn-primario" type="button" id="prog-guardar" data-l10n-es="Guardar" data-l10n-en="Save" data-l10n-zh="保存">Guardar</button>
      </div>
    </div>
  </div>

  <div class="prog-modal" id="prog-modal-reg" hidden>
    <div class="prog-modal__caja" role="dialog" aria-modal="true" aria-labelledby="prog-reg-tit">
      <div class="prog-modal__cab">
        <div>
          <h2 id="prog-reg-tit">Registrar</h2>
          <small id="prog-reg-sub"></small>
        </div>
        <button class="icono-btn" type="button" data-prog-cerrar="prog-modal-reg" aria-label="Cerrar">×</button>
      </div>
      <div class="prog-campos">
        <label><span data-l10n-es="Valor" data-l10n-en="Value" data-l10n-zh="数值">Valor</span>
          <input id="prog-r-valor" type="number" step="any"></label>
        <label><span data-l10n-es="Cuándo" data-l10n-en="When" data-l10n-zh="时间">Cuándo</span>
          <input id="prog-r-cuando" type="datetime-local"></label>
        <label class="todo"><span data-l10n-es="Nota (opcional)" data-l10n-en="Note (optional)" data-l10n-zh="备注（可选）">Nota (opcional)</span>
          <input id="prog-r-nota" type="text" maxlength="120" placeholder="Almuerzo, serie 3, en la biblioteca…"></label>
        <p class="prog-ayuda" data-l10n-es="El registro se puede editar o borrar después." data-l10n-en="The entry can be edited or deleted later." data-l10n-zh="记录之后可以编辑或删除。">El registro se puede editar o borrar después.</p>
      </div>
      <div class="prog-modal__pie">
        <span class="crece"></span>
        <button class="btn" type="button" data-prog-cerrar="prog-modal-reg" data-l10n-es="Cancelar" data-l10n-en="Cancel" data-l10n-zh="取消">Cancelar</button>
        <button class="btn btn-primario" type="button" id="prog-registrar" data-l10n-es="Registrar" data-l10n-en="Log" data-l10n-zh="记录">Registrar</button>
      </div>
    </div>
  </div>
  `;
})();
