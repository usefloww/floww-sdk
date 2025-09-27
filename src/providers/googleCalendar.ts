import { Provider, Trigger, Handler } from "../common";

export class GoogleCalendar implements Provider {
    private email: string;

    constructor(email: string) {
        this.email = email;
    }

    triggers = {
        onEventCreate: (args: { data: { calendarId: string }, handler: Handler }): Trigger => {
            return {
                infrastructure: [],
                handler: args.handler,
            }
        }
    }

    actions = {}
}
