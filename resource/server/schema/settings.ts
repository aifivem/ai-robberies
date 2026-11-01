import { BLIP_STYLE_FIELDS } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { truckCard } from "./truckCard";

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    policeJobs: {
      type: "names",
      lookup: "job",
      max: 10,
      itemMax: 32,
      pattern: "^[a-z0-9_]{2,32}$",
    },
    account: { type: "text", lookup: "account", min: 2, max: 32 },
    blip: {
      type: "object",
      optional: true,
      fields: BLIP_STYLE_FIELDS,
    },
    truck: {
      type: "object",
      fields: {
        account: {
          type: "text",
          lookup: "account",
          min: 2,
          max: 32,
          optional: true,
        },
        truckModel: { type: "text", min: 1, max: 64, optional: true },
        guardModel: { type: "text", min: 1, max: 64, optional: true },
        guardWeapon: { type: "text", min: 1, max: 64, optional: true },
        lifetime: {
          type: "number",
          min: 1,
          max: 240,
          integer: true,
          optional: true,
        },
        plantSeconds: {
          type: "number",
          min: 1,
          max: 120,
          integer: true,
          optional: true,
        },
        fuseSeconds: {
          type: "number",
          min: 1,
          max: 120,
          integer: true,
          optional: true,
        },
        lootSeconds: {
          type: "number",
          min: 1,
          max: 120,
          integer: true,
          optional: true,
        },
        giver: { type: "vec4" },
        price: { type: "number", min: 0, max: 1_000_000, integer: true },
        minPolice: { type: "number", min: 0, max: 32, integer: true },
        cooldown: { type: "number", min: 1, max: 1440, integer: true },
        item: { type: "text", lookup: "item", min: 2, max: 48 },
        cashMin: { type: "number", min: 0, max: 1_000_000, integer: true },
        cashMax: { type: "number", min: 0, max: 1_000_000, integer: true },
        spawns: {
          type: "list",
          max: 30,
          of: { type: "object", fields: { coords: { type: "vec4" } } },
        },
      },
    },
  },
};

export const settingsTab: TabSpec = {
  id: "settings",
  file: "settings",
  icon: "sliders",
  label: "ADMIN_TAB_SETTINGS",
  desc: "ADMIN_TAB_SETTINGS_DESC",
  cards: [
    {
      icon: "sliders",
      title: "ADMIN_C_SETTINGS",
      desc: "ADMIN_C_SETTINGS_DESC",
      fields: [
        {
          widget: "tags",
          lookup: "job",
          path: "policeJobs",
          label: "ADMIN_F_POLICE_JOBS",
          hint: "ADMIN_H_POLICE_JOBS",
          placeholder: "ADMIN_P_POLICE_JOBS",
        },
        {
          widget: "text",
          lookup: "account",
          path: "account",
          label: "ADMIN_F_ACCOUNT",
          hint: "ADMIN_H_ACCOUNT",
          placeholder: "ADMIN_P_ACCOUNT",
        },
        {
          widget: "blip",
          path: "blip",
          label: "ADMIN_F_BLIP_STYLE",
          hint: "ADMIN_H_BLIP_STYLE",
        },
      ],
    },
    truckCard,
  ],
};
