import { Gitlab } from "floww";

const gitlab = new Gitlab("asdfasdf");

gitlab.triggers.onMergeRequest({
  projectId: "19677180",
  handler: async (ctx, event) => {
    console.log(event.body.reviewers);
  },
});
