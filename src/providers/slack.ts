import { BaseProvider } from "./base";

export class Slack extends BaseProvider {
  providerType = "slack";

  actions = {};
  triggers = {};
}
