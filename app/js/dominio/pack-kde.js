/* pack-kde.js — paquete de terceros de ejemplo: KDE Breeze.

   Iconos simbólicos de Breeze (KDE Plasma), bajo LGPL-2.0-or-later /
   LGPL-3.0-or-later. Son una muestra de ocho iconos para demostrar que un pack
   de terceros entra sin tocar el codigo: la interfaz muestra su procedencia y
   su licencia, y la documentacion (docs/ICONOS.md y CREDITOS.md) las repite.
   Fuente: https://invent.kde.org/frameworks/breeze-icons
   La capa `iconos-pack.js` sanea cada SVG antes de inyectarlo como <symbol>. */
window.MimoPackKDE = {
  "id": "kde",
  "nombre": "KDE Breeze",
  "procedencia": "KDE Breeze Icons (KDE Plasma)",
  "licencia": "LGPL-2.0-or-later / LGPL-3.0-or-later",
  "origen": "https://invent.kde.org/frameworks/breeze-icons",
  "iconos": [
    {
      "id": "view-calendar",
      "nombre": "Calendario",
      "cat": "general",
      "tags": [
        "calendario",
        "fecha",
        "agenda"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"M 6 3 C 6 3 5 2.99997 5 4 L 3 4 L 3 7 L 3 18 L 3 19 L 19 19 L 19 18 L 19 7 L 19 4 L 17 4 C 17 2.99997 16 3 16 3 L 13 3 C 13 3 12 2.99997 12 4 L 10 4 C 10 2.99997 9 3 9 3 L 6 3 z M 6 4 L 9 4 L 9 5 L 6 5 L 6 4 z M 13 4 L 16 4 L 16 5 L 13 5 L 13 4 z M 4 7 L 18 7 L 18 18 L 4 18 L 4 7 z M 6 8 L 6 10 L 8 10 L 8 8 L 6 8 z M 10 8 L 10 10 L 12 10 L 12 8 L 10 8 z M 14 8 L 14 10 L 16 10 L 16 8 L 14 8 z M 6 11 L 6 13 L 8 13 L 8 11 L 6 11 z M 10 11 L 10 13 L 12 13 L 12 11 L 10 11 z M 14 11 L 14 13 L 16 13 L 16 11 L 14 11 z M 14 14 L 14 16 L 16 16 L 16 14 L 14 14 z \" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "appointment-new",
      "nombre": "Nueva cita",
      "cat": "general",
      "tags": [
        "cita",
        "evento",
        "agenda"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"m11 3c-4.431998 0-8 3.568002-8 8 0 4.431998 3.568002 8 8 8 4.431998 0 8-3.568002 8-8 0-4.431998-3.568002-8-8-8m0 1c3.877999 0 7 3.122001 7 7 0 3.877999-3.122001 7-7 7-3.877999 0-7-3.122001-7-7 0-3.877999 3.122001-7 7-7m-1 1v7h1 5v-1h-5v-6h-1\" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "checkmark",
      "nombre": "Marca",
      "cat": "general",
      "tags": [
        "hecho",
        "check",
        "completar"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"m382.8643 530.79077l-10.43876 10.56644-4.14699-4.19772-.70712.71578 4.14699 4.1977-.002.002.70713.71577.002-.002.002.002.70711-.71577-.002-.002 10.43877-10.56645-.70712-.71576z\" transform=\"translate(-364.57143-525.79075)\" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "chronometer",
      "nombre": "Cronómetro",
      "cat": "general",
      "tags": [
        "tiempo",
        "medir",
        "cronometro"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"m11 3c-1.107998 0-2 .892002-2 2 0 .097284.011719.192036.025391.285156-2.909648.848995-5.02539 3.523737-5.02539 6.714844 0 3.878 3.122 7 7 7 3.878 0 7-3.122 7-7 0-1.586301-.52733-3.04152-1.410156-4.212891.243033-.182096.410156-.45871.410156-.787109 0-.554-.446-1-1-1-.328399 0-.605013.167123-.787109.410156-.664149-.500549-1.418203-.885712-2.238282-1.125.013672-.09312.025391-.187873.025391-.285156 0-1.107998-.892002-2-2-2m0 1c.554004 0 1 .445996 1 1 0 .027034-.01354.049691-.015625.076172-.322538-.045169-.648999-.076172-.984375-.076172-.335376 0-.661837.031003-.984375.076172-.002085-.026481-.015625-.049138-.015625-.076172 0-.554004.445996-1 1-1m0 2c.25958 0 .513703.01932.763672.052734.034758.004386.068949.010651.103516.015625.242093.036669.480551.085481.71289.148438 2.550944.691228 4.419922 3.00762 4.419922 5.783203 0 3.324-2.676 6-6 6-3.324 0-6-2.676-6-6 0-2.775584 1.868978-5.091975 4.419922-5.783203.23234-.062957.470797-.111768.71289-.148438.034567-.004974.068758-.011239.103516-.015625.249969-.033414.504092-.052734.763672-.052734m0 1v4c.554 0 1 .446 1 1h4c0-2.77-2.23-5-5-5\" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "office-chart-bar",
      "nombre": "Gráfico",
      "cat": "general",
      "tags": [
        "grafico",
        "datos",
        "progreso"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"M 4 3 L 4 9 L 4 10 L 4 15 L 4 16 L 4 17 L 3 17 L 3 18 L 4 18 L 4 19 L 5 19 L 5 18 L 19 18 L 19 17 L 16 17 L 16 8 L 15 8 L 12 8 L 12 17 L 10 17 L 10 7 L 10 4 L 10 3 L 6 3 L 6 17 L 5 17 L 5 16 L 5 15 L 5 12 L 5 11 L 5 10 L 5 9 L 5 6 L 5 5.9921875 L 5 5 L 5 3 L 4 3 z M 7 4 L 9 4 L 9 17 L 7 17 L 7 4 z M 13 9 L 15 9 L 15 17 L 13 17 L 13 9 z \" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "document-edit",
      "nombre": "Editar",
      "cat": "general",
      "tags": [
        "editar",
        "documento",
        "nota"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"m14.996094 3l-11.992188 11.992188h-.003906v4.00781h1 2 1.00781v-.003906l11.992188-11.992188-.001953-.001953.001953-.001953-4-4-.001953.001953-.001953-.001953m-1.998047 3.412109l2.589844 2.589844-7.587891 7.587891v-1.589844h-1-1v-1-.589844l6.998047-6.998047m-7.998047 7.998047v1.589844h1 1v1 .589844l-.410156.410156h-1.589844l-1-1v-1.589844l1-1\" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "media-playback-start",
      "nombre": "Empezar",
      "cat": "general",
      "tags": [
        "play",
        "inicio",
        "empezar"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <style type=\"text/css\" id=\"current-color-scheme\">\n        .ColorScheme-Text {\n            color:#232629;\n        }\n    </style>\n  <g transform=\"translate(1,1)\">\n    <path d=\"m3 3v16l16-8z\" class=\"ColorScheme-Text\" fill=\"currentColor\"/>\n  </g>\n</svg>\n"
    },
    {
      "id": "bookmarks",
      "nombre": "Marcadores",
      "cat": "general",
      "tags": [
        "marcador",
        "favorito",
        "lista"
      ],
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">\n  <defs id=\"defs3051\">\n    <style type=\"text/css\" id=\"current-color-scheme\">\n      .ColorScheme-Text {\n        color:#232629;\n      }\n      </style>\n  </defs>\n  <g transform=\"translate(1,1)\">\n    <path style=\"fill:currentColor;fill-opacity:1;stroke:none\" d=\"m6 3v1 14 1l5-2 5 2v-1-14-1h-10m1 1h8v13.599609l-4-1.599609-4 1.599609v-13.599609\" class=\"ColorScheme-Text\"/>\n  </g>\n</svg>\n"
    }
  ]
};
