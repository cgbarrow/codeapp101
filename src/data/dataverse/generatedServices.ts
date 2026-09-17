import { Cb_todolistsService } from "@/generated/services/Cb_todolistsService";
import { Cb_todosubtasksService } from "@/generated/services/Cb_todosubtasksService";
import { Cb_todotasksService } from "@/generated/services/Cb_todotasksService";
import type { DataverseServices } from "./dataverseRepos";

/** The pa-generated service classes, which talk to Dataverse through the Power Apps host. */
export const generatedServices: DataverseServices = {
  lists: Cb_todolistsService,
  tasks: Cb_todotasksService,
  subtasks: Cb_todosubtasksService,
};
