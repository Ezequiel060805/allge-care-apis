#ESTRUCTURA DEL PROYECTO
project-root/
├── src/                         # Código fuente
│   ├── config/                  # Parámetros de configuración
│   │   ├── db.js                # Pool de conexión a MySQL
│   │   └── env.js               # Carga de variables de entorno
│   │
│   ├── middleware/              # Middlewares genéricos
│   │   ├── cors.js              # Configuración de CORS
│   │   ├── rateLimiter.js       # Límite de peticiones
│   │   └── auth.js              # Verificación de JWT
│   │
│   ├── routes/                  # Definición de endpoints
│   │   ├── auth.js              # /api/auth/register, /api/auth/login
│   │   └── users.js             # /api/users, /api/users/:id, …
│   │
│   ├── controllers/             # Lógica de cada endpoint
│   │   ├── authController.js    # register(), login(), …
│   │   └── usersController.js   # getUsers(), createUser(), …
│   │
│   ├── models/                  # Acceso a datos (queries, ORM, …)
│   │   ├── userModel.js         # Funciones CRUD sobre tabla users
│   │   └── tokenModel.js        # (si guardar tokens, por ejemplo)
│   │
│   ├── utils/                   # Funciones auxiliares
│   │   ├── jwt.js               # Firma/validación de JWT
│   │   └── errorHandler.js      # Formateo de errores comunes
│   │
│   ├── app.js                   # Configura express: middlewares + rutas
│   └── server.js                # Arranque del servidor (app.listen)
│
├── .env                         # Variables privadas
├── package.json
└── README.md

# Allge-Care-Apis
# Allge-Care-Apis
