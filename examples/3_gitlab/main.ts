import { getProvider } from "floww";

const gitlab = getProvider("gitlab", "asdfasdf");

gitlab.triggers.onMergeRequest({
  projectId: "19677180",
  handler: async (ctx, event) => {
    console.log(event.body.reviewers);
  },
});
