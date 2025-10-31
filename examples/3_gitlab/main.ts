import { getProvider } from "@developerflows/floww-sdk";

const gitlab = getProvider("gitlab", "asdfasdf");

gitlab.triggers.onMergeRequest({
  projectId: "19677180",
  handler: async (ctx, event) => {
    console.log(event.body.reviewers);
  },
});
