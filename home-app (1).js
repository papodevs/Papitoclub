
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

  onAuthStateChanged

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



onAuthStateChanged(auth, async (user) => {

  if (!user) return location.href = "index.html";

  currentUser = user;

  cargarMenu();

  mostrarMensajes();

  escucharMensajesPublicos();

});



async function cargarMenu() {

  const res = await fetch("menu.html");

  const html = await res.text();

  document.getElementById("menu-superior").innerHTML = html;



  if (!window.logout) {

    window.logout = () => {

      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js").then(({ getAuth, signOut }) => {

        const auth = getAuth();

        signOut(auth).then(() => location.href = "index.html");

      });

    };

  }

}



async function obtenerPerfil(uid) {

  const perfilSnap = await getDoc(doc(db, "users", uid));

  return perfilSnap.exists() ? perfilSnap.data() : {};

}



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

            <span onclick="darLike('${id}')" style="cursor:pointer;">❤️ Like (${(post.likes || []).length})</span>

            <span onclick="darRePapo('${id}')" style="cursor:pointer;">🔁 RePapo (${(post.repapos || []).length})</span>

            <span onclick="toggleComentarios('${id}')" style="cursor:pointer;">💬 Comment</span>

            <span onclick="navigator.clipboard.writeText(location.href+'#${id}')" style="cursor:pointer;">📤 Share</span>

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



export async function darLike(id) {

  const ref = doc(db, "publicaciones", id);

  const snap = await getDoc(ref);

  const data = snap.data();

  const likes = new Set(data.likes || []);

  if (likes.has(currentUser.uid)) likes.delete(currentUser.uid);

  else likes.add(currentUser.uid);

  await updateDoc(ref, { likes: Array.from(likes) });

}



export async function darRePapo(id) {

  const ref = doc(db, "publicaciones", id);

  const snap = await getDoc(ref);

  const data = snap.data();

  const repapos = new Set(data.repapos || []);

  if (repapos.has(currentUser.uid)) repapos.delete(currentUser.uid);

  else repapos.add(currentUser.uid);

  await updateDoc(ref, { repapos: Array.from(repapos) });

}



export function toggleComentarios(id) {

  const box = document.getElementById("comentarios-" + id);

  box.style.display = box.style.display === "none" ? "block" : "none";

}



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

}



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



// Exponer funciones globales si se importa con <script type="module">

window.publicarMensaje = publicarMensaje;

window.darLike = darLike;

window.darRePapo = darRePapo;

window.toggleComentarios = toggleComentarios;

window.enviarComentario = enviarComentario;

window.enviarMensaje = enviarMensaje;
