// /js/components/admin/customers/dogs.js
"use strict";

import { esc, genId } from "../../../core/utils.js";

function byId(id) { return document.getElementById(id); }

function updateDogTitles(){
  const wrap = byId("c_dogs");
  if(!wrap) return;
  const cards = Array.from(wrap.querySelectorAll(".card-panel"));
  cards.forEach((card, idx)=>{
    const t = card.querySelector("[data-dog-title]");
    if(t) t.textContent = `Hund ${idx+1}`;
  });
}

export function addDogRow(d) {
  const wrap = byId("c_dogs");
  if(!wrap) return;

  const id = d?.id || genId();

  const card = document.createElement("div");
  card.className = "card-panel";
  card.dataset.dogId = id;

  card.innerHTML = `
    <div style="
      display:flex; justify-content:space-between; align-items:center; gap:10px;
      padding:6px 2px 10px 2px; border-bottom:1px solid #eee; margin-bottom:10px">
      <div data-dog-title style="font-weight:900; font-size:14px">Hund</div>
      <button class="btn danger" type="button" data-dog-remove style="padding:6px 10px; height:auto">
        Entfernen
      </button>
    </div>

    <div class="fg4">
      <label>Name <input name="dog_name" value="${esc(d?.name||"")}"></label>
      <label>Rasse <input name="dog_breed" value="${esc(d?.breed||"")}"></label>
      <label>Geschlecht
        <select name="dog_sex">
          <option value="m"${d?.sex==="m" ? " selected" : ""}>männlich</option>
          <option value="w"${d?.sex==="w" ? " selected" : ""}>weiblich</option>
        </select>
      </label>
      <label>Alter <input name="dog_age" value="${esc(d?.age||"")}"></label>

      <label>Chip-ID <input name="dog_chip" value="${esc(d?.chipId||"")}"></label>
      <label>Kastriert?
        <select name="dog_neutered">
          <option value="no"${!d?.neutered ? " selected" : ""}>nein</option>
          <option value="yes"${d?.neutered ? " selected" : ""}>ja</option>
        </select>
      </label>
      <label>Sozial?
        <select name="dog_social">
          <option value="no"${!d?.social ? " selected" : ""}>nein</option>
          <option value="yes"${d?.social ? " selected" : ""}>ja</option>
        </select>
      </label>
      <label>Futter verteidigt?
        <select name="dog_foodGuarding">
          <option value="no"${!d?.foodGuarding ? " selected" : ""}>nein</option>
          <option value="yes"${d?.foodGuarding ? " selected" : ""}>ja</option>
        </select>
      </label>

      <label>Angst (Gewitter/Feuerwerk)?
        <select name="dog_fear">
          <option value="no"${!d?.fearStormFireworks ? " selected" : ""}>nein</option>
          <option value="yes"${d?.fearStormFireworks ? " selected" : ""}>ja</option>
        </select>
      </label>
      <label>Fütterung <textarea name="dog_feedNotes">${esc(d?.feedingNotes||"")}</textarea></label>
      <label>Leckerlies?
        <select name="dog_treats">
          <option value="no"${!d?.treatsAllowed ? " selected" : ""}>nein</option>
          <option value="yes"${d?.treatsAllowed ? " selected" : ""}>ja</option>
        </select>
      </label>
      <label>Allergien <textarea name="dog_allergies">${esc(d?.allergiesMedsNotes||"")}</textarea></label>
    </div>
  `;

  wrap.appendChild(card);

  // Entfernen + neu nummerieren
  card.querySelector("[data-dog-remove]")?.addEventListener("click", ()=>{
    card.remove();
    updateDogTitles();
  });

  updateDogTitles();
}