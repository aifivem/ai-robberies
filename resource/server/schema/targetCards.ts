import type { CardSpec } from "@aicore-fivem/shared";

export const doorCard: CardSpec = {
  icon: "lock",
  title: "ADMIN_C_DOOR",
  desc: "ADMIN_C_DOOR_DESC",
  fields: [
    {
      widget: "text",
      path: "door",
      label: "ADMIN_F_DOOR",
      hint: "ADMIN_H_DOOR",
      placeholder: "ADMIN_P_DOOR",
    },
    {
      widget: "text",
      path: "vaultModel",
      label: "ADMIN_F_VAULT_MODEL",
      hint: "ADMIN_H_VAULT_MODEL",
      placeholder: "ADMIN_P_VAULT_MODEL",
    },
    {
      widget: "number",
      path: "vaultClosed",
      label: "ADMIN_F_VAULT_CLOSED",
      min: -720,
      max: 720,
      step: 0.5,
      unit: "°",
    },
    {
      widget: "number",
      path: "vaultOpen",
      label: "ADMIN_F_VAULT_OPEN",
      min: -720,
      max: 720,
      step: 0.5,
      unit: "°",
    },
  ],
};

export const rewardCard: CardSpec = {
  icon: "money-bill-wave",
  title: "ADMIN_C_REWARD",
  desc: "ADMIN_C_REWARD_DESC",
  fields: [
    {
      widget: "number",
      path: "cashMin",
      label: "ADMIN_F_CASH_MIN",
      min: 0,
      max: 1_000_000,
      unit: "$",
    },
    {
      widget: "number",
      path: "cashMax",
      label: "ADMIN_F_CASH_MAX",
      min: 0,
      max: 1_000_000,
      unit: "$",
    },
    {
      widget: "text",
      lookup: "item",
      path: "reward",
      label: "ADMIN_F_REWARD",
      hint: "ADMIN_H_REWARD",
      placeholder: "ADMIN_P_REWARD",
    },
    {
      widget: "number",
      path: "rewardMin",
      label: "ADMIN_F_REWARD_MIN",
      min: 0,
      max: 100,
    },
    {
      widget: "number",
      path: "rewardMax",
      label: "ADMIN_F_REWARD_MAX",
      min: 0,
      max: 100,
    },
  ],
};
