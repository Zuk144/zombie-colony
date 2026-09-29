// Medicine: bleeding, healing, the infection-vs-immunity race, patients, doctors, rescue.
// See docs/DESIGN.md §6. Bites are treatable: a tended, bed-rested survivor usually wins the
// race; an untreated one usually doesn't.

import { TICKS_PER_DAY, SURVIVOR, MEDICAL, INFECTION } from './config.js';
import { THINGS } from './defs.js';
import { allThings, dist, reservedByOther, tkey, canReachThing, isSpawned, letter } from './world.js';
import { learn } from './pawn.js';
import { addMemory } from './mood.js';
import { killHuman, goDown } from './combat.js';
import { goTo, work, pickUp, instant, claimBed, DONE, FAIL } from './jobs.js';

export const pkey = (p) => 'p' + p.id;
export const isTended = (w, p) => p.tendedUntil > w.tick;
export const needsTending = (w, p) =>
  p.faction === 'colony' && (p.bleed > MEDICAL.tendNeededBleed || (!!p.infection && !isTended(w, p)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Health over time (every rare tick) -----------------------------------

export function tickHealth(w, p, dt) {
  const days = dt / TICKS_PER_DAY;
  const tended = isTended(w, p);

  if (p.bleed > 0) {
    p.hp -= p.bleed * days;
    p.bleed = Math.max(0, p.bleed * Math.pow(1 - MEDICAL.bleedDecayPerDay, days) - 2 * days);
    if (p.hp <= 0) return killHuman(w, p, 'bled out');
    if (!p.downed && p.hp < SURVIVOR.downedBelow) goDown(w, p);
  }

  if (p.infection) {
    const inf = p.infection, q = tended ? p.tendQuality : 0;
    inf.severity += INFECTION.severityPerDay * days * (1 - INFECTION.tendSlows * q);
    inf.immunity += INFECTION.immunityPerDay * days * (p.inBed != null ? INFECTION.bedImmunityMult : 1) * (1 + INFECTION.tendImmunityBoost * q);
    if (inf.immunity >= 1) {
      p.infection = null;
      w.stats.cured++;
      addMemory(p, 'beatInfection');
      letter(w, `${p.name} fought off the infection!`, 'good', p);
    } else if (inf.severity >= 1) {
      return killHuman(w, p, 'succumbed to the infection', 0.01);
    }
  }

  // Healing: faster lying down, in a bed, and when tended; stalls while bleeding hard.
  const rate = SURVIVOR.healPerDay
    * (p.asleep || p.downed || p.lying ? 3 : 1)
    * (p.inBed != null ? MEDICAL.bedHealMult : 1)
    * (tended ? 1 + p.tendQuality : 1)
    * (p.infection ? 0.3 : 1)
    * Math.max(0, 1 - p.bleed / 10);
  p.hp = Math.min(p.maxHp, p.hp + rate * days);
  if (p.downed && p.hp >= SURVIVOR.downedBelow + 10) {
    p.downed = false;
    letter(w, `${p.name} is back on their feet.`, 'neutral', p);
  }
}

// ---- Treatment --------------------------------------------------------------

// Quality 0..1 from the doctor's skill and the medicine (medkit 1.0, herbs 0.6, none 0).
export function applyTend(w, patient, doctor, potency, selfFactor = 1) {
  const lvl = doctor.skills.medical?.level ?? 0;
  const base = Math.min(1, 0.3 + 0.035 * lvl);
  patient.tendQuality = clamp(base * (potency > 0 ? 0.55 + 0.45 * potency : 0.45) * selfFactor, 0.05, 1);
  patient.bleed = 0;
  patient.tendedUntil = w.tick + MEDICAL.tendDuration * TICKS_PER_DAY;
  learn(doctor, 'medical', 60);
}

export function bestMedicine(w, p) {
  return allThings(w, (t, d) => d.medicine && !reservedByOther(w, tkey(t), p))
    .map((t) => ({ t, score: dist(p, t) - THINGS[t.def].medicine * 25 }))
    .sort((a, b) => a.score - b.score)
    .find(({ t }) => canReachThing(w, p, t))?.t ?? null;
}

const canDoctor = (p) => p.priorities.doctor > 0 && !p.incapable.has('doctor');

// The patient goes to bed and waits. Infected survivors stay for bed rest (it speeds immunity).
// If no doctor shows up for a while, a capable patient treats themselves (worse quality).
export function patientJob(w, p) {
  const bed = claimBed(w, p);
  return {
    def: 'patient', kind: 'need', report: bed ? 'in bed, waiting for a doctor' : 'lying down, waiting for a doctor', bed,
    failIf: (w, p, j) => !!j.bed && !isSpawned(w, j.bed),
    toils: [
      ...(bed ? [goTo((j) => j.bed, false)] : []),
      {
        init(w, p, j) { j.waited = 0; j.selfWork = 0; },
        tick(w, p, j) {
          p.lying = true;
          if (j.bed) p.inBed = j.bed.id;
          j.waited++;
          if (j.selfWork > 0) {
            j.report = 'treating own wounds';
            if (--j.selfWork === 0) applyTend(w, p, p, 0, 0.7);
            return;
          }
          if (needsTending(w, p) && j.waited > 1500 && canDoctor(p) && !w.reservations.has(pkey(p))) {
            j.selfWork = MEDICAL.tendWork * 1.5;
            return;
          }
          if (!needsTending(w, p) && !p.infection && j.waited > 60) return DONE;
          if (j.waited > 4000) return DONE; // rethink (eat, etc.), come back if still needed
        },
      },
    ],
  };
}

export function tendJob(w, doc, patient, med) {
  return {
    def: 'tend', kind: 'work', report: `treating ${patient.name}${med ? '' : ' (no medicine)'}`, patient, item: med,
    reserve: [pkey(patient), ...(med ? [tkey(med)] : [])],
    failIf: (w, d, j) => j.patient.gone || j.patient.carriedBy || (!j.patient.downed && !j.patient.lying) || (j.item && !d.carrying && !isSpawned(w, j.item)),
    toils: [
      ...(med ? [goTo((j) => j.item, true), pickUp('item', () => 1)] : []),
      goTo((j) => j.patient, true),
      work({ amount: () => MEDICAL.tendWork, skill: 'medical', target: (j) => j.patient, onDone: (w, d, j) => {
        const potency = d.carrying ? THINGS[d.carrying.def].medicine ?? 0 : 0;
        d.carrying = null;
        applyTend(w, j.patient, d, potency);
      } }),
    ],
  };
}

// Carry a downed survivor to a bed (theirs, else any free one).
export function rescueJob(w, r, downed) {
  const bed = claimBed(w, downed, r);
  if (!bed) return null;
  return {
    def: 'rescue', kind: 'work', report: `rescuing ${downed.name}`, patient: downed, bed,
    reserve: [pkey(downed), tkey(bed)],
    failIf: (w, r, j) => j.patient.gone || !isSpawned(w, j.bed) || (!j.patient.downed && !r.carryingPawn),
    toils: [
      goTo((j) => j.patient, true),
      instant((w, r, j) => {
        const d = j.patient;
        if (!d.downed || d.carriedBy) return FAIL;
        r.carryingPawn = d;
        d.carriedBy = r;
        d.x = r.x;
        d.y = r.y;
      }),
      goTo((j) => j.bed, false),
      instant((w, r, j) => {
        const d = j.patient;
        r.carryingPawn = null;
        d.carriedBy = null;
        d.x = j.bed.x;
        d.y = j.bed.y;
        d.inBed = j.bed.id;
        addMemory(d, 'wasRescued');
        return DONE;
      }),
    ],
  };
}
