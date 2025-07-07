// home-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJmOS9MjDhjJrKCMIUVbgmRiEi2xLIkrQ",
  authDomain: "papoclub-737ac.firebaseapp.com",
  projectId: "papoclub-737ac",
  storageBucket: "papoclub-737ac.appspot.com",
  messagingSenderId: "76712370993",
  appId: "1:76712370993:web:2d2646b258efbccf68c73e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser;

// Al iniciar sesión
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";
  currentUser = user;
  await cargarMenu();
  mostrarMensajes();
  escucharMensajesPublicos();
  inicializarEventosUI();
});

async function cargarMenu() {
  const res = await fetch("menu.html");
  const html = await res.text();
  document.getElementById("menu-superior").innerHTML = html;

  if (!window.logout) {
    window.logout = () => {
      signOut(auth).then(() => location.href = "index.html");
    };
  }
}

async function obtenerPerfil(uid) {
  const perfilSnap = await getDoc(doc(db, "users", uid));
  return perfilSnap.exists() ? perfilSnap.data() : {};
}

// Publicar nuevo mensaje
export async function publicarMensaje() {
  const texto = document.getElementById("nuevoMensaje").value.trim();
  if (!texto) return;
  const perfil = await obtenerPerfil(currentUser.uid);
  await addDoc(collection(db, "publicaciones"), {
    autorUID: currentUser.uid,
    autorNick: perfil.nick || currentUser.email.split("@")[0],
    autorAvatar: perfil.avatar || "https://via.placeholder.com/30?text=👤",
    texto,
    fecha: new Date(),
    likes: [],
    repapos: []
  });
  document.getElementById("nuevoMensaje").value = "";
}

// Mostrar mensajes (posts) con actualización en tiempo real
export function mostrarMensajes() {
  const q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"));
  const contenedor = document.getElementById("listaMensajes");
  onSnapshot(q, (snapshot) => {
    contenedor.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const post = docSnap.data();
      const id = docSnap.id;
      contenedor.innerHTML += `
        <div class="tarjeta">
          <p><img src="${post.autorAvatar}" width="30" style="border-radius:50%;vertical-align:middle"> <strong>@${post.autorNick}</strong></p>
          <p>${post.texto}</p>
          <div class="interacciones">
            <span data-action="like" data-id="${id}" style="cursor:pointer;">❤️ Like (${(post.likes || []).length})</span>
            <span data-action="repapo" data-id="${id}" style="cursor:pointer;">🔁 RePapo (${(post.repapos || []).length})</span>
            <span data-action="comment" data-id="${id}" style="cursor:pointer;">💬 Comment</span>
            <span data-action="share" data-id="${id}" style="cursor:pointer;">📤 Share</span>
          </div>
          <div class="comentarios" id="comentarios-${id}" style="display:none">
            <textarea id="comentario-${id}" placeholder="Escribe un comentario..."></textarea>
            <button onclick="enviarComentario('${id}')">Comentar</button>
            <div id="lista-comentarios-${id}"></div>
          </div>
        </div>`;
    });
  });
}

// Dar Like / Quitar Like
export async function darLike(id) {
  const ref = doc(db, "publicaciones", id);
  const snap = await getDoc(ref);
  const data = snap.data();
  const likes = new Set(data.likes || []);
  if (likes.has(currentUser.uid)) likes.delete(currentUser.uid);
  else likes.add(currentUser.uid);
  await updateDoc(ref, { likes: Array.from(likes) });
}

// Dar RePapo / Quitar RePapo
export async function darRePapo(id) {
  const ref = doc(db, "publicaciones", id);
  const snap = await getDoc(ref);
  const data = snap.data();
  const repapos = new Set(data.repapos || []);
  if (repapos.has(currentUser.uid)) repapos.delete(currentUser.uid);
  else repapos.add(currentUser.uid);
  await updateDoc(ref, { repapos: Array.from(repapos) });
}

// Mostrar u ocultar comentarios
export function toggleComentarios(id) {
  const box = document.getElementById("comentarios-" + id);
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
  if (box.style.display === "block") cargarComentarios(id);
}

// Enviar comentario a un post
export async function enviarComentario(postId) {
  const texto = document.getElementById("comentario-" + postId).value.trim();
  if (!texto) return;
  const perfil = await obtenerPerfil(currentUser.uid);
  await addDoc(collection(db, `publicaciones/${postId}/comentarios`), {
    uid: currentUser.uid,
    nick: perfil.nick || currentUser.email.split("@")[0],
    avatar: perfil.avatar || "https://via.placeholder.com/30?text=👤",
    texto,
    fecha: new Date()
  });
  document.getElementById("comentario-" + postId).value = "";
  cargarComentarios(postId);
}

// Cargar y mostrar comentarios en tiempo real para un post
function cargarComentarios(postId) {
  const q = query(collection(db, `publicaciones/${postId}/comentarios`), orderBy("fecha", "asc"));
  const cont = document.getElementById(`lista-comentarios-${postId}`);
  if (!cont) return;
  onSnapshot(q, (snapshot) => {
    cont.innerHTML = "";
    snapshot.forEach(doc => {
      const c = doc.data();
      const fecha = new Date(c.fecha.seconds * 1000).toLocaleString();
      cont.innerHTML += `
        <div class="comentario">
          <p><img src="${c.avatar}" width="25" style="border-radius:50%;vertical-align:middle"> <strong>@${c.nick}</strong> <span style="font-size:0.8em;color:#666;">${fecha}</span></p>
          <p>${c.texto}</p>
        </div>`;
    });
  });
}

// Escuchar mensajes públicos en tiempo real para chat público
export function escucharMensajesPublicos() {
  const q = query(collection(db, "chatPublico"), orderBy("fecha", "asc"));
  const contenedor = document.getElementById("mensajes-chat");
  onSnapshot(q, (snap) => {
    contenedor.innerHTML = "";
    snap.forEach(doc => {
      const m = doc.data();
      const fecha = new Date(m.fecha.seconds * 1000).toLocaleTimeString();
      contenedor.innerHTML += `
        <div class="mensaje-chat">
          <p><img src="${m.avatar}" width="25" style="border-radius:50%;vertical-align:middle"> <strong>@${m.nick}</strong> <span style="font-size:0.8em;color:#ccc;">${fecha}</span></p>
          <p>${m.texto}</p>
        </div>`;
    });
    contenedor.scrollTop = contenedor.scrollHeight;
  });
}

// Enviar mensaje al chat público
export async function enviarMensaje() {
  const texto = document.getElementById("mensaje").value.trim();
  if (!texto) return;
  const perfil = await obtenerPerfil(currentUser.uid);
  await addDoc(collection(db, "chatPublico"), {
    texto,
    uid: currentUser.uid,
    nick: perfil.nick || currentUser.email.split("@")[0],
    avatar: perfil.avatar || "https://via.placeholder.com/30?text=👤",
    fecha: new Date()
  });
  document.getElementById("mensaje").value = "";
}

// Inicializar eventos UI para interacción
export function inicializarEventosUI() {
  // Botón flotante chat en mobile
  const btnChat = document.getElementById('btn-flotante-chat');
  if (btnChat) {
    btnChat.addEventListener('click', () => {
      window.location.href = 'chat.html';
    });
  }

  // Delegar clicks en botones dentro de #listaMensajes usando data-action y data-id
  const lista = document.getElementById('listaMensajes');
  if (lista) {
    lista.addEventListener('click', async (e) => {
      const el = e.target;
      if (!el.dataset.action || !el.dataset.id) return;
      const action = el.dataset.action;
      const id = el.dataset.id;

      if (action === 'like') {
        await darLike(id);
      } else if (action === 'repapo') {
        await darRePapo(id);
      } else if (action === 'comment') {
        toggleComentarios(id);
      } else if (action === 'share') {
        const postLink = `${location.origin}${location.pathname}#${id}`;
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Papoclub Post',
              text: 'Mira este post en Papoclub',
              url: postLink
            });
          } catch (err) {
            alert('No se pudo compartir: ' + err);
          }
        } else {
          await navigator.clipboard.writeText(postLink);
          alert('Link copiado al portapapeles para compartir');
        }
      }
    });

    // Enviar comentario con Enter sin Shift
    lista.addEventListener('keypress', (e) => {
      const target = e.target;
      if (!target || !target.id.startsWith('comentario-')) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const postId = target.id.replace('comentario-', '');
        enviarComentario(postId);
      }
    });
  }

  // Botón publicar post
  const btnPublicar = document.getElementById('btnPublicar');
  if (btnPublicar) {
    btnPublicar.addEventListener('click', () => {
      publicarMensaje();
    });
  }

  // Botón enviar mensaje chat público
  const btnEnviar = document.getElementById('btnEnviar');
  if (btnEnviar) {
    btnEnviar.addEventListener('click', () => {
      enviarMensaje();
    });
  }
}

// Exportar funciones globales para uso desde HTML
window.publicarMensaje = publicarMensaje;
window.darLike = darLike;
window.darRePapo = darRePapo;
window.toggleComentarios = toggleComentarios;
window.enviarComentario = enviarComentario;
window.enviarMensaje = enviarMensaje;
window.logout = () => signOut(auth).then(() => location.href = "index.html");
window.inicializarEventosUI = inicializarEventosUI;
