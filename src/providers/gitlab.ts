import { Provider, Trigger, Handler } from "../common";
import * as pulumi_gitlab from "@pulumi/gitlab";

export class Gitlab implements Provider {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    actions = {}
    triggers = {
        onMergeRequestComment: (args: { data: { projectId: string } | { groupId: string }, handler: Handler }): Trigger => {
            if ("projectId" in args.data) {
                return {
                    infrastructure: [
                        new pulumi_gitlab.ProjectHook("on-merge-request-comment", {
                            name: "Flow Hook",
                            url: "https://domain/api/v1/gitlab/webhook",
                            project: args.data.projectId,
                            mergeRequestsEvents: true,
                        }),
                    ],
                    handler: args.handler,
                }
            }
            if ("groupId" in args.data) {
                return {
                    infrastructure: [
                        new pulumi_gitlab.GroupHook("on-merge-request-comment", {
                            name: "Flow Hook",
                            group: args.data.groupId,
                            mergeRequestsEvents: true,
                            url: "https://domain/api/v1/gitlab/webhook",
                        }),
                    ],
                    handler: args.handler,
                }
            }
            throw new Error("Either projectId or groupId must be provided");
        }
    }
}