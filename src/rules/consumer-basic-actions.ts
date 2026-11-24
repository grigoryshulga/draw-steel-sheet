import actions from "../generated/consumers/basic-actions-en.json";

export const basicActionEditions: Readonly<Record<string, (typeof actions)[keyof typeof actions]>> = actions;
