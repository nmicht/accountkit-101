require('dotenv').config();

const fs = require('fs');
const Guid = require('guid');
const express = require('express');
const bodyParser = require('body-parser');
const Mustache = require('mustache');
const Request = require('request');
const Querystring = require('querystring');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Generate a string for CSRF
var csrfGuid = Guid.raw();

// Define values for accountkit
const AK_API_VERSION = 'v1.1';
const AK_APP_ID = process.env.FB_APP_ID;
const AK_APP_SECRET = process.env.FB_APP_SECRET;
const AK_ME_URL = `https://graph.accountkit.com/${AK_API_VERSION}/me`;
const AK_TOKEN_URL = `https://graph.accountkit.com/${AK_API_VERSION}/access_token`;

// Función para cargar la vista
function loadLogin() {
  return fs.readFileSync('views/login.html').toString();
}

// Función para cargar la vista
function loadLoginSuccess() {
  return fs.readFileSync('views/login_success.html').toString();
}

app.get('/', (request, response) => {
  const view = {
    appId: AK_APP_ID,
    csrf: csrfGuid,
    version: AK_API_VERSION,
  };

  const html = Mustache.to_html(loadLogin(), view);
  response.send(html);
});

app.post('/login_success', (request, response) => {
  // CSRF check
  if (request.body.csrf === csrfGuid) {
    // Generar el token para la app
    // @see https://developers.facebook.com/docs/accountkit/accesstokens
    const appAccessToken = ['AA', AK_APP_ID, AK_APP_SECRET].join('|');

    const params = {
      grant_type: 'authorization_code',
      code: request.body.code,
      access_token: appAccessToken,
    };

    // Intercambio de tokens
    const tokenExchangeUrl = `${AK_TOKEN_URL}?${Querystring.stringify(params)}`;
    Request.get({ url: tokenExchangeUrl, json: true }, (err, resp, respBody) => {
      const view = {
        user_access_token: respBody.access_token,
        expires_at: respBody.expires_at,
        user_id: respBody.id,
      };

      // Obtener los detalles de la cuenta loggeada
      const meEndpointUrl = `${AK_ME_URL}?access_token=${respBody.access_token}`;
      Request.get({ url: meEndpointUrl, json: true }, (err, resp, respBody) => {
        // Mandamos ahora si, la vista despues del login
        if (respBody.phone) {
          view.phone_num = respBody.phone.number;
        } else if (respBody.email) {
          view.email_addr = respBody.email.address;
        }
        const html = Mustache.to_html(loadLoginSuccess(), view);
        response.send(html);
      });
    });
  } else {
    // Manejar el error cuando el CSRF no coincide
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('Something went wrong. :( ');
  }
});


app.listen(process.env.PORT);
