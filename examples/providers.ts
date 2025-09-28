import { Builtin, Gitlab, GoogleCalendar, Slack } from "@trigger/sdk";

export const googleCalendar = new GoogleCalendar("toon.de.neve1@gmail.com");
export const builtin = new Builtin();
export const gitlab = new Gitlab("1234567890");
export const slack = new Slack();
