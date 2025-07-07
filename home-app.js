// home-app-optimizado.js
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
  getDoc,
  where,
  limit
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

let currentUser = null;
const perfilCache = new Map();

// Para controlar listeners de comentarios activos
const comentariosListeners = new Map();

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";
  currentUser = user;
  await cargarMenu();
  mostrarMensajes();
  escucharMensajesPublicos();
  inicializarEventosUI();
});

async function cargarMenu() {
  try {
    const res = await fetch("menu.html");
    const html = await res.text();
    document.getElementById("menu-superior").innerHTML = html;

    if (!window.logout) {
      window.logout = () => {
        signOut(auth).then(() => location.href = "index.html");
      };
    }
  } catch (error) {
    console.error("Error cargando menú:", error);
  }
}

async function obtenerPerfil(uid) {
  if (perfilCache.has(uid)) {
    return perfilCache.get(uid);
  }
  try {
    const perfilSnap = await getDoc(doc(db, "users", uid));
    const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
    perfilCache.set(uid, perfil);
    return perfil;
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    return {};
  }
}

export async function publicarMensaje() {
  try {
    const texto = document.getElementById("nuevoMensaje").value.trim();
    if (!texto) return alert("Escribe algo antes de publicar.");

    if (texto.length > 280) return alert("Mensaje demasiado largo. Máximo 280 caracteres.");

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
  } catch (err) {
    console.error('Error al publicar mensaje:', err);
    alert('No se pudo publicar el mensaje. Intenta nuevamente.');
  }
}

export function mostrarMensajes() {
  const q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"), limit(50));
  const contenedor = document.getElementById("listaMensajes");

  onSnapshot(q, (snapshot) => {
    const fragment = document.createDocumentFragment();
    contenedor.innerHTML = ''; // limpiar antes de renderizar

    snapshot.forEach((docSnap) => {
      const post = docSnap.data();
      const id = docSnap.id;

      const div = document.createElement('div');
      div.className = 'tarjeta';
      div.innerHTML = `
        <p>
          <img src="${post.autorAvatar}" width="30" style="border-radius:50%;vertical-align:middle" alt="avatar">
          <strong>@${post.autorNick}</strong>
          <span style="font-size:0.75em;color:#0cc;margin-left:10px;">${new Date(post.fecha.toMillis()).toLocaleString()}</span>
        </p>
        <p>${escapeHtml(post.texto)}</p>
        <div class="interacciones">
          <span data-action="like" data-id="${id}" style="cursor:pointer;">❤️ Like (${(post.likes || []).length})</span>
          <span data-action="repapo" data-id="${id}" style="cursor:pointer;">🔁 RePapo (${(post.repapos || []).length})</span>
          <span data-action="comment" data-id="${id}" style="cursor:pointer;">💬 Comment</span>
          <span data-action="share" data-id="${id}" style="cursor:pointer;">📤 Share</span>
        </div>
        <div class="comentarios" id="comentarios-${id}" style="display:none; margin-top: 10px;">
          <textarea id="comentario-${id}" placeholder="Escribe un comentario..." rows="3" style="width: 100%; resize: vertical;"></textarea>
          <button data-action="enviarComentario" data-id="${id}">Comentar</button>
          <div id="lista-comentarios-${id}" style="margin-top:8px; max-height: 250px; overflow-y: auto;"></div>
        </div>`;

      fragment.appendChild(div);
    });

    contenedor.appendChild(fragment);
  });
}

// Escapar texto para evitar XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

export async function darLike(id) {
  try {
    const ref = doc(db, "publicaciones", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const likes = new Set(data.likes || []);
    if (likes.has(currentUser.uid)) likes.delete(currentUser.uid);
    else likes.add(currentUser.uid);
    await updateDoc(ref, { likes: Array.from(likes) });
  } catch (error) {
    console.error("Error darLike:", error);
  }
}

export async function darRePapo(id) {
  try {
    const ref = doc(db, "publicaciones", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const repapos = new Set(data.repapos || []);
    if (repapos.has(currentUser.uid)) repapos.delete(currentUser.uid);
    else repapos.add(currentUser.uid);
    await updateDoc(ref, { repapos: Array.from(repapos) });
  } catch (error) {
    console.error("Error darRePapo:", error);
  }
}

export function toggleComentarios(id) {
  const box = document.getElementById("comentarios-" + id);
  if (!box) return;

  if (box.style.display === "block") {
    box.style.display = "none";
    removerListenerComentarios(id);
  } else {
    box.style.display = "block";
    cargarComentarios(id);
  }
}

async function enviarComentario(postId) {
  try {
    const input = document.getElementById("comentario-" + postId);
    if (!input) return;

    const texto = input.value.trim();
    if (!texto) return alert("Escribe un comentario válido.");

    if (texto.length > 280) return alert("Comentario demasiado largo. Máximo 280 caracteres.");

    const perfil = await obtenerPerfil(currentUser.uid);
    await addDoc(collection(db, `publicaciones/${postId}/comentarios`), {
      uid: currentUser.uid,
      nick: perfil.nick || currentUser.email.split("@")[0],
      avatar: perfil.avatar || "https://via.placeholder.com/30?text=👤",
      texto,
      fecha: new Date()
    });
    input.value = "";
  } catch (error) {
    console.error("Error enviando comentario:", error);
    alert("No se pudo enviar el comentario.");
  }
}

// Cargar comentarios con listener y limpiarlos para evitar duplicados
function cargarComentarios(postId) {
  const cont = document.getElementById(`lista-comentarios-${postId}`);
  if (!cont) return;

  // Si ya existe listener, no creamos otro
  if (comentariosListeners.has(postId)) return;

  const q = query(collection(db, `publicaciones/${postId}/comentarios`), orderBy("fecha", "asc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    cont.innerHTML = '';
    snapshot.forEach(doc => {
      const c = doc.data();
      const fecha = new Date(c.fecha.toMillis()).toLocaleString();
      const div = document.createElement('div');
      div.className = 'comentario';
      div.style.borderBottom = "1px solid #00e5ff44";
      div.style.padding = "6px 0";
      div.innerHTML = `
        <p><img src="${c.avatar}" width="25" style="border-radius:50%;vertical-align:middle" alt="avatar"> 
          <strong>@${c.nick}</strong> 
          <span style="font-size:0.8em;color:#666;">${fecha}</span>
        </p>
        <p>${escapeHtml(c.texto)}</p>`;
      cont.appendChild(div);
    });
  });

  comentariosListeners.set(postId, unsubscribe);
}

// Remover listener de comentarios cuando se oculta el panel
function removerListenerComentarios(postId) {
  const unsubscribe = comentariosListeners.get(postId);
  if (unsubscribe) {
    unsubscribe();
    comentariosListeners.delete(postId);
  }
}

export function escucharMensajesPublicos() {
  const q = query(collection(db, "chatPublico"), orderBy("fecha", "asc"), limit(100));
  const contenedor = document.getElementById("mensajes-chat");

  onSnapshot(q, (snap) => {
    contenedor.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      const fecha = new Date(m.fecha.toMillis()).toLocaleTimeString();
      const div = document.createElement('div');
      div.className = 'mensaje-chat';
      div.style.marginBottom = "8px";
      div.innerHTML = `
        <p>
          <img src="${m.avatar}" width="25" style="border-radius:50%;vertical-align:middle" alt="avatar"> 
          <strong>@${m.nick}</strong> 
          <span style="font-size:0.8em;color:#ccc;">${fecha}</span>
        </p>
        <p>${escapeHtml(m.texto)}</p>`;
      contenedor.appendChild(div);
    });
    contenedor.scrollTop = contenedor.scrollHeight;
  });
}

export async function enviarMensaje() {
  try {
    const input = document.getElementById("mensaje");
    if (!input) return;

    const texto = input.value.trim();
    if (!texto) return alert("Escribe un mensaje para enviar.");

    if (texto.length > 150) return alert("Mensaje demasiado largo. Máximo 150 caracteres.");

    const perfil = await obtenerPerfil(currentUser.uid);
    await addDoc(collection(db, "chatPublico"), {
      texto,
      uid: currentUser.uid,
      nick: perfil.nick || currentUser.email.split("@")[0],
      avatar: perfil.avatar || "https://via.placeholder.com/30?text=👤",
      fecha: new Date()
    });
    input.value = "";
  } catch (error) {
    console.error("Error enviando mensaje público:", error);
    alert("No se pudo enviar el mensaje público.");
  }
}

function inicializarEventosUI() {
  // Delegación en contenedor posts para botones interactivos
  const lista = document.getElementById('listaMensajes');
  if (lista) {
    lista.addEventListener('click', async (e) => {
      const el = e.target;
      if (!el.dataset.action) return;

      const id = el.dataset.id;
      switch (el.dataset.action) {
        case 'like':
          await darLike(id);
          break;
        case 'repapo':
          await darRePapo(id);
          break;
        case 'comment':
          toggleComentarios(id);
          break;
        case 'share':
          const postLink = `${location.origin}${location.pathname}#${id}`;
          if (navigator.share) {
            try {
              await navigator.share({
                title: 'Papoclub Post',
                text: 'Mira este post en Papoclub',
                url: postLink
              });
            } catch {
              alert('No se pudo compartir');
            }
          } else {
            await navigator.clipboard.writeText(postLink);
            alert('Link copiado al portapapeles');
          }
          break;
        case 'enviarComentario':
          await enviarComentario(id);
          break;
      }
    });

    // Enviar comentario con Enter (sin Shift)
    lista.addEventListener('keydown', (e) => {
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
  const btnPublicar = document.querySelector('.nuevo-mensaje button');
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

window.publicarMensaje = publicarMensaje;
window.darLike = darLike;
window.darRePapo = darRePapo;
window.toggleComentarios = toggleComentarios;
window.enviarComentario = enviarComentario;
window.enviarMensaje = enviarMensaje;
window.logout = () => signOut(auth).then(() => location.href = "index.html");
window.inicializarEventosUI = inicializarEventosUI;
