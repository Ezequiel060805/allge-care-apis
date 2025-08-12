require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();

// Habilitar CORS para permitir conexiones desde el cliente
app.use(cors());
// Parseo de JSON en peticiones
app.use(express.json());
// Límite de peticiones para prevenir abuso
app.use(
  rateLimit({
    windowMs: 60_000, // 1 minuto
    max: 1000,          // máximo 10 peticiones por IP
  })
);

// Pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Requisitos (si aún no los tienes):
// npm i bcrypt jsonwebtoken
const bcrypt = require('bcrypt');

// Ruta de login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan email o contraseña' });
    }

    // Busca por correo; la columna "contrasena" DEBE almacenar el hash de bcrypt
    const [rows] = await pool.execute(
      'SELECT id, contrasena FROM usuarios WHERE correo = ? LIMIT 1',
      [email]
    );

    const user = rows[0];

    // Por seguridad, no reveles si el usuario existe o no
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Compara el password plano contra el hash almacenado
    const passwordOk = await bcrypt.compare(password, user.contrasena);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Verifica que haya secreto configurado
    if (!process.env.JWT_SECRET) {
      console.error('Falta la variable de entorno JWT_SECRET');
      return res.status(500).json({ error: 'Configuración del servidor inválida' });
    }

    // Genera un JWT con claims comunes
    const token = jwt.sign(
      {
        sub: user.id,                 // sujeto (ID del usuario)
        typ: 'access',                // tipo de token (opcional)
      },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '15m',             // expira en 15 minutos
        issuer: process.env.JWT_ISSUER || '',
      }
    );

    return res.json({ token });
  } catch (err) {
    console.error('Error en /api/login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------------------------------
// Nuevos endpoints para las interfaces de React Native
// -----------------------------------------------------------------------------
/**
 * GET /data/usuario
 * Retorna los campos nombre, correo, fecha_creacion y rol.
 * Si se recibe query param `email`, filtra solo el usuario con ese correo.
 */
app.get('/data/usuario', async (req, res) => {
  try {
    const { email } = req.query;
    let result;

    if (email) {
      [result] = await pool.execute(
        'SELECT nombre, correo, fecha_creacion, rol FROM usuarios WHERE correo = ?',
        [email]
      );
    } else {
      [result] = await pool.execute(
        'SELECT nombre, correo, fecha_creacion, rol FROM usuarios'
      );
    }

    return res.json(result);
  } catch (err) {
    console.error('Error en /data/usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /data/mediciones
 * Retorna:
 *  - latest: última lectura (ph, temperatura, luz, hora)
 *  - maxLastDay: máximos de ph y temperatura en últimas 24h
 *  - lastDayData, lastWeekData, lastMonthData: arrays de lecturas para gráficas
 */
app.get('/data/mediciones', async (req, res) => {
  try {
    // Última medición registrada
    const [latestRows] = await pool.execute(
      `SELECT ph_valor AS ph,
              temperatura_valor AS temperatura,
              luz_presente AS luz,
              hora_registro AS hora
       FROM mediciones
       ORDER BY fecha_registro DESC, hora_registro DESC
       LIMIT 1`
    );
    const latest = latestRows[0] || null;

    // Valores máximos de ph y temperatura en últimas 24 horas
    const [maxRows] = await pool.execute(
      `SELECT MAX(ph_valor) AS maxPh,
              MAX(temperatura_valor) AS maxTemp
       FROM mediciones
       WHERE fecha_registro >= DATE_SUB(NOW(), INTERVAL 1 DAY)`
    );
    const maxLastDay = {
      maxPh: maxRows[0].maxPh,
      maxTemp: maxRows[0].maxTemp,
    };


    // 👇 NUEVO: valores mínimos de ph y temperatura en últimas 24 horas
    const [minRows] = await pool.execute(
      `SELECT MIN(ph_valor) AS minPh,
              MIN(temperatura_valor) AS minTemp
       FROM mediciones
       WHERE fecha_registro >= DATE_SUB(NOW(), INTERVAL 1 DAY)`
    );
    const minLastDay = {
      minPh: minRows[0].minPh,
      minTemp: minRows[0].minTemp,
    };

    // Datos para gráficas: último día, semana y mes
    const [lastDayData] = await pool.execute(
      `SELECT ph_valor AS ph,
              temperatura_valor AS temperatura,
              dia_registro,
              hora_registro AS hora
       FROM mediciones
       WHERE fecha_registro >= DATE_SUB(NOW(), INTERVAL 1 DAY)
       ORDER BY fecha_registro, hora_registro`
    );
    const [lastWeekData] = await pool.execute(
      `SELECT ph_valor AS ph,
              temperatura_valor AS temperatura,
              dia_registro,
              hora_registro AS hora
       FROM mediciones
       WHERE fecha_registro >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY fecha_registro, hora_registro`
    );
    const [lastMonthData] = await pool.execute(
      `SELECT ph_valor AS ph,
              temperatura_valor AS temperatura,
              dia_registro,
              hora_registro AS hora
       FROM mediciones
       WHERE fecha_registro >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY fecha_registro, hora_registro`
    );

    return res.json({ latest, maxLastDay, lastDayData, lastWeekData, lastMonthData, minLastDay });
  } catch (err) {
    console.error('Error en /data/mediciones:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /data/configuraciones
 * Retorna los parámetros de configuración: ph_min, ph_max,
 * temperatura_min, temperatura_max y agitacion_recomendada.
 */
app.get('/data/configuraciones', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ph_min,
              ph_max,
              temperatura_min,
              temperatura_max,
              agitacion_recomendada AS agitacion,
              intervalo
       FROM configuraciones`
    );
    const config = rows[0] || null; // Configuración global
    return res.json(config);
  } catch (err) {
    console.error('Error en /data/configuraciones:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/*
 * GET /data/alertas 
 * Retorna los parametros de alertas: fecha_alerta, hora_alerta, 
 * comentarios, ph_valor, luz detectada, temperatura
 */
app.get('/data/alertas', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT fecha_alerta,
              hora_alerta,
              comentarios,
              ph_valor,
              luz_detectada,
              temperatura
       FROM alertas`
    );
    const config = rows[0] || null; // Configuración global
    return res.json(config);
  } catch (err) {
    console.error('Error en /data/alertas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});
/**
 * POST /data/configuraciones
 * Actualiza parcialmente la configuración.
 * - Solo se actualizan las claves recibidas en el body.
 * - Por defecto actualiza la fila con id = 1 (o puedes pasar { id } en el body).
 * Body permitido (cualquiera de estos campos): 
 *   ph_min, ph_max, temperatura_min, temperatura_max, agitacion_recomendada, intervalo
 */
// POST /data/configuraciones  -> Actualiza solo los campos enviados
app.post('/data/configuraciones', async (req, res) => {
  try {
    const allowed = [
      'ph_min',
      'ph_max',
      'temperatura_min',
      'temperatura_max',
      'agitacion_recomendada',
      'intervalo'
    ];

    const setClauses = [];
    const values = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos a actualizar' });
    }

    // actualiza por id (o usa 1 por defecto)
    const id = req.body.id ?? 1;
    values.push(id);

    const [result] = await pool.execute(
      `UPDATE configuraciones
       SET ${setClauses.join(', ')}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    const [rows] = await pool.execute(
      `SELECT ph_min, ph_max, temperatura_min, temperatura_max,
              agitacion_recomendada AS agitacion, intervalo
       FROM configuraciones WHERE id = ?`,
      [id]
    );

    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('Error en POST /data/configuraciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Arrancar servidor escuchando en todas las interfaces
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API escuchando en puerto ${PORT}`);
});

