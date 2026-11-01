import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const placesFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    coords: { x: 0, y: 0, z: 0 },
    minPolice: 0,
    cooldown: 30,
    alertChance: 100,
    blip: false,
    interior: { x: 0, y: 0, z: 0, heading: 0 },
  },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    coords: { type: "vec3" },
    minPolice: { type: "number", min: 0, max: 32, integer: true },
    cooldown: { type: "number", min: 1, max: 1440, integer: true },
    alertChance: { type: "number", min: 0, max: 100, integer: true },
    blip: { type: "bool" },
    interior: { type: "vec4" },
  },
};

export const placesTab: TabSpec = {
  id: "places",
  file: "places",
  icon: "store",
  label: "ADMIN_TAB_PLACES",
  desc: "ADMIN_TAB_PLACES_DESC",
  createLabel: "ADMIN_NEW_PLACE",
  deleteLabel: "ADMIN_DELETE_PLACE",
  deleteDesc: "ADMIN_DELETE_PLACE_DESC",
  cards: [
    {
      icon: "store",
      title: "ADMIN_C_PLACE",
      desc: "ADMIN_C_PLACE_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          suggest: { from: "coords" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_LABEL",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_COORDS",
          hint: "ADMIN_H_COORDS",
          ground: true,
        },
        {
          widget: "number",
          path: "minPolice",
          label: "ADMIN_F_MIN_POLICE",
          hint: "ADMIN_H_MIN_POLICE",
          min: 0,
          max: 32,
        },
        {
          widget: "number",
          path: "cooldown",
          label: "ADMIN_F_COOLDOWN",
          hint: "ADMIN_H_COOLDOWN",
          min: 1,
          max: 1440,
          unit: "min",
        },
        {
          widget: "number",
          path: "alertChance",
          label: "ADMIN_F_ALERT",
          hint: "ADMIN_H_ALERT",
          min: 0,
          max: 100,
          unit: "%",
        },
        { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
      ],
    },
    {
      icon: "location-dot",
      title: "ADMIN_C_HOUSE",
      desc: "ADMIN_C_HOUSE_DESC",
      fields: [
        {
          widget: "point",
          path: "interior",
          label: "ADMIN_F_INTERIOR",
          hint: "ADMIN_H_INTERIOR",
          heading: true,
          ground: true,
        },
      ],
    },
  ],
};
