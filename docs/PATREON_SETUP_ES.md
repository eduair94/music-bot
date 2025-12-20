#  Guía de Configuración de Patreon para el Bot de Música

> **Nivel de dificultad:** Principiante  
> **Tiempo estimado:** 15-20 minutos

Esta guía te explicará paso a paso cómo obtener todas las credenciales necesarias para integrar Patreon con tu bot de música de Discord.

---

##  Tabla de Contenidos

1. [Requisitos Previos](#-requisitos-previos)
2. [Crear una Cuenta de Creador en Patreon](#-paso-1-crear-una-cuenta-de-creador-en-patreon)
3. [Crear un Cliente API](#-paso-2-crear-un-cliente-api)
4. [Obtener el Client ID y Client Secret](#-paso-3-obtener-el-client-id-y-client-secret)
5. [Obtener el Creator Access Token](#-paso-4-obtener-el-creator-access-token)
6. [Encontrar tu Campaign ID](#-paso-5-encontrar-tu-campaign-id)
7. [Encontrar el Tier ID de Founder](#-paso-6-encontrar-el-tier-id-de-founder)
8. [Configurar Webhooks (Opcional)](#-paso-7-configurar-webhooks-opcional)
9. [Agregar las Variables al Bot](#-paso-8-agregar-las-variables-al-bot)
10. [Verificar la Configuración](#-paso-9-verificar-la-configuración)

---

##  Requisitos Previos

Antes de comenzar, asegúrate de tener:

- ✅ Una cuenta de Patreon (si no tienes, créala en [patreon.com](https://www.patreon.com))
- ✅ Acceso a una computadora con navegador web
- ✅ El archivo `config.json` de tu bot listo para editar

---

##  Paso 1: Crear una Cuenta de Creador en Patreon

Si ya tienes una cuenta de creador en Patreon, puedes saltar al Paso 2.

1. Ve a [patreon.com](https://www.patreon.com)
2. Haz clic en **"Crear en Patreon"** o **"Create on Patreon"** (arriba a la derecha)
3. Inicia sesión con tu cuenta existente o crea una nueva
4. Sigue los pasos para configurar tu página de creador:
   - Elige un nombre para tu página
   - Selecciona una categoría (puedes elegir "Música" o "Tecnología")
   - Configura al menos un nivel de membresía (tier)

###  Importante sobre los Tiers (Niveles)

Para que el bot funcione correctamente, necesitas crear al menos un tier que será tu tier de **"Founder / Beta Tester"**. Este tier dará acceso a las funciones premium del bot.

**Para crear un tier:**
1. Ve a tu página de creador
2. Haz clic en **"Editar página"** o **"Edit page"**
3. Ve a la sección **"Tiers"** o **"Niveles"**
4. Haz clic en **"Añadir tier"** o **"Add tier"**
5. Configura el nombre (ej: "Founder" o "Beta Tester") y el precio

---

##  Paso 2: Crear un Cliente API

1. Abre tu navegador y ve a: **[patreon.com/portal/registration/register-clients](https://www.patreon.com/portal/registration/register-clients)**

2. Inicia sesión con tu cuenta de Patreon si no lo has hecho

3. Haz clic en el botón **"Create Client"** (Crear Cliente)

4. Llena el formulario con la siguiente información:

   | Campo | Qué poner |
   |-------|-----------|
   | **App Name** | El nombre de tu bot (ej: "Mi Bot de Música") |
   | **Description** | Una descripción breve (ej: "Bot de música para Discord") |
   | **App Category** | Selecciona "Bots" o la categoría más apropiada |
   | **Redirect URIs** | Escribe: `http://localhost` |
   | **Client API Version** | Selecciona **"2"** (muy importante) |

5. Haz clic en **"Create Client"** para guardar

---

##  Paso 3: Obtener el Client ID y Client Secret

Después de crear el cliente, verás una página con la información de tu aplicación.

### Para encontrar el Client ID:

1. En la página de tu cliente, busca el campo **"Client ID"**
2. Verás un código largo parecido a esto: `AbCdEfGhIjKlMnOpQrStUvWxYz123456`
3. Haz clic en el botón de copiar o selecciona y copia el código

 **Guarda este valor como:** `PATREON_CLIENT_ID`

### Para encontrar el Client Secret:

1. En la misma página, busca el campo **"Client Secret"**
2. Haz clic en **"Show"** (Mostrar) si está oculto
3. Copia el código secreto

 **Guarda este valor como:** `PATREON_CLIENT_SECRET`

> ⚠️ **¡IMPORTANTE!** Nunca compartas tu Client Secret con nadie. Es como una contraseña.

---

##  Paso 4: Obtener el Creator Access Token

El "Creator Access Token" es una clave especial que permite al bot acceder a la información de tus patrocinadores.

1. En la página de tu cliente API, busca la sección **"Creator's Access Token"**

2. Haz clic en el botón **"Create Token"** (Crear Token)

3. Se generará un token largo. **¡COPIA ESTE TOKEN INMEDIATAMENTE!**

   > ⚠️ **MUY IMPORTANTE:** Este token solo se muestra UNA VEZ. Si no lo copias ahora, tendrás que generar uno nuevo.

4. El token se verá algo así: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (muy largo)

 **Guarda este valor como:** `PATREON_CREATOR_ACCESS_TOKEN`

---

##  Paso 5: Encontrar tu Campaign ID

El Campaign ID es el identificador único de tu página de creador.

### Método 1: Desde la URL (Más fácil)

1. Ve a tu página de creador en Patreon
2. Haz clic en **"Editar página"** o **"Edit page"**
3. Mira la URL en tu navegador, se verá algo así:
   ```
   https://www.patreon.com/dashboard/creator/123456789
   ```
4. El número al final (`123456789`) es tu **Campaign ID**

### Método 2: Usando la API (Si el método 1 no funciona)

1. Abre una nueva pestaña en tu navegador
2. Ve a esta URL (reemplaza `TU_TOKEN` con tu Creator Access Token):
   ```
   https://www.patreon.com/api/oauth2/v2/campaigns
   ```
3. Necesitarás usar una herramienta como [Postman](https://www.postman.com/) o [Insomnia](https://insomnia.rest/) para hacer la petición con el header:
   ```
   Authorization: Bearer TU_TOKEN_AQUI
   ```

 **Guarda este valor como:** `PATREON_CAMPAIGN_ID`

---

##  Paso 6: Encontrar el Tier ID de Founder

El Tier ID identifica el nivel de membresía que otorga beneficios premium.

### Método más sencillo:

1. Usa una herramienta para hacer peticiones API (como Postman, Insomnia, o incluso desde la terminal)

2. Haz una petición GET a:
   ```
   https://www.patreon.com/api/oauth2/v2/campaigns/TU_CAMPAIGN_ID/tiers
   ```

3. Incluye este header:
   ```
   Authorization: Bearer TU_CREATOR_ACCESS_TOKEN
   ```

4. La respuesta te mostrará todos tus tiers con sus IDs

### Ejemplo de respuesta:
```json
{
  "data": [
    {
      "id": "1234567",
      "type": "tier",
      "attributes": {
        "title": "Founder",
        "amount_cents": 500
      }
    }
  ]
}
```

El valor de `"id"` (en este ejemplo `1234567`) es tu **Tier ID**.

 **Guarda este valor como:** `PATREON_FOUNDER_TIER_ID`

---

##  Paso 7: Configurar Webhooks (Opcional)

Los webhooks permiten que Patreon notifique a tu bot instantáneamente cuando alguien se suscribe o cancela. **Este paso es opcional** pero recomendado para actualizaciones en tiempo real.

### Si tu bot está alojado en un servidor con IP pública:

1. Ve a la configuración de tu cliente API en Patreon
2. Busca la sección **"Webhooks"**
3. Haz clic en **"Create Webhook"**
4. Ingresa la URL de tu bot donde recibirá las notificaciones:
   ```
   https://tu-servidor.com/api/patreon/webhook
   ```
5. Selecciona los eventos que quieres recibir:
   - ✅ `members:create` (cuando alguien se suscribe)
   - ✅ `members:update` (cuando alguien actualiza su suscripción)
   - ✅ `members:delete` (cuando alguien cancela)
   - ✅ `members:pledge:create` (cuando se crea un pledge)
   - ✅ `members:pledge:update` (cuando se actualiza un pledge)
   - ✅ `members:pledge:delete` (cuando se elimina un pledge)

6. Copia el **"Webhook Secret"** que se genera

 **Guarda este valor como:** `PATREON_WEBHOOK_SECRET`

>  Si tu bot está en tu computadora local, puedes omitir este paso. El bot sincronizará los patrocinadores automáticamente cada 30 minutos.

---

## ⚙️ Paso 8: Agregar las Variables al Bot

Ahora que tienes todas las credenciales, agrégalas a tu archivo `config.json`:

1. Abre el archivo `config.json` en la carpeta de tu bot

2. Busca la sección de Patreon (o agrégala si no existe):

```json
{
  "TOKEN": "tu_token_de_discord",
  "MONGO_URI": "tu_uri_de_mongodb",
  
  "PATREON_CLIENT_ID": "tu_client_id_aqui",
  "PATREON_CLIENT_SECRET": "tu_client_secret_aqui",
  "PATREON_CREATOR_ACCESS_TOKEN": "tu_access_token_aqui",
  "PATREON_CAMPAIGN_ID": "tu_campaign_id_aqui",
  "PATREON_FOUNDER_TIER_ID": "tu_founder_tier_id_aqui",
  "PATREON_WEBHOOK_SECRET": "tu_webhook_secret_aqui_o_dejalo_vacio"
}
```

3. Reemplaza cada valor con las credenciales que guardaste en los pasos anteriores

4. Guarda el archivo

---

## ✅ Paso 9: Verificar la Configuración

Para asegurarte de que todo está configurado correctamente:

1. Inicia tu bot
2. En Discord, usa el comando `/premium`
3. El bot debería responder mostrando el estado de tu membresía

### Posibles mensajes:

- **"No eres un usuario premium"** - Normal si no eres patrono de ti mismo
- **"Eres un Founder/Beta Tester"** - ¡La integración funciona correctamente!
- **Error de conexión** - Revisa que tus credenciales estén correctas

---

##  Solución de Problemas

### El bot no detecta mis patrocinadores

1. Verifica que el `PATREON_CREATOR_ACCESS_TOKEN` sea correcto
2. Asegúrate de que el token no haya expirado
3. Confirma que el `PATREON_CAMPAIGN_ID` sea el correcto

### Error "Invalid Client"

1. Revisa que `PATREON_CLIENT_ID` y `PATREON_CLIENT_SECRET` estén correctos
2. Asegúrate de no tener espacios extra antes o después de los valores

### Los patrocinadores nuevos no aparecen inmediatamente

- El bot sincroniza cada 30 minutos automáticamente
- Si configuraste webhooks, las actualizaciones deberían ser instantáneas
- Puedes reiniciar el bot para forzar una sincronización

### No encuentro mi Campaign ID

1. Asegúrate de tener una página de creador activa
2. Verifica que hayas creado al menos un tier

---

##  Recursos Adicionales

- [Documentación oficial de la API de Patreon](https://docs.patreon.com/)
- [Portal de desarrolladores de Patreon](https://www.patreon.com/portal)
- [Postman (herramienta gratuita para probar APIs)](https://www.postman.com/downloads/)

---

##  ¡Felicidades!

Has completado la configuración de Patreon para tu bot de música. Ahora tus patrocinadores podrán disfrutar de las funciones premium automáticamente.

**Funciones Premium disponibles para Founders:**
- ️ Filtros de audio avanzados
-  Máxima calidad de audio
- ⏰ Modo 24/7 (el bot no se desconecta)
-  Cola de reproducción prioritaria
-  Playlists ilimitadas
-  Canciones más largas
- ️ Funciones de votación
-  Rol especial de Founder
-  Soporte directo

---

*¿Tienes preguntas? Únete a nuestro servidor de Discord para obtener ayuda.*
