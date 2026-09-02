// config.js — réglages de déploiement (modifiables sans toucher au code).
//
// Relais TURN : indispensable quand deux joueurs ne peuvent pas se joindre en direct (4G, box
// restrictive, réseau d'entreprise). Sans réglage, l'app utilise Open Relay en authentification
// statique (gratuit, sans compte, sans garantie). Recommandé : créer un compte gratuit Open Relay
// (https://www.metered.ca/tools/openrelay/ — 20 Go/mois), puis coller ici l'URL de credentials :
//   export const TURN_CREDENTIALS_URL = 'https://VOTREAPP.metered.live/api/v1/turn/credentials?apiKey=VOTRE_CLE';
// La clé est visible dans le code de la page : c'est le fonctionnement prévu par Metered ; le quota est celui du compte.
export const TURN_CREDENTIALS_URL = 'https://hachihachi.metered.live/api/v1/turn/credentials?apiKey=60fd34d5c99b2aba8668f9ccc83804f26dd4';
// Ou une liste explicite de serveurs ICE (format RTCIceServer), par exemple un coturn à vous :
//   export const TURN_SERVERS = [{ urls: ['turn:mon.serveur:3478'], username: 'u', credential: 'p' }];
export const TURN_SERVERS = null;
