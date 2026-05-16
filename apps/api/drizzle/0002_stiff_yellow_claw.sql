CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"session_id" uuid,
	"plan_id" uuid,
	"snapshot_id" uuid,
	"description" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"parent_snapshot_id" uuid,
	"reason" varchar(30) NOT NULL,
	"status" varchar(15) DEFAULT 'creating' NOT NULL,
	"plan_id" uuid,
	"plan_version" integer,
	"blueprint_id" uuid,
	"task_graph_id" uuid,
	"interview_session_id" uuid,
	"answer_count" integer DEFAULT 0 NOT NULL,
	"affected_phase_types" text,
	"change_summary" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_graphs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"plan_version" integer NOT NULL,
	"graph_version" integer DEFAULT 1 NOT NULL,
	"derived_from_graph_id" uuid,
	"status" varchar(15) DEFAULT 'generating' NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	"dependency_count" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_artifacts" ALTER COLUMN "status" SET DATA TYPE varchar(15);--> statement-breakpoint
ALTER TABLE "prompt_artifacts" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "prompt_artifacts" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_snapshot_id_project_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."project_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_task_graph_id_task_graphs_id_fk" FOREIGN KEY ("task_graph_id") REFERENCES "public"."task_graphs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_interview_session_id_interview_sessions_id_fk" FOREIGN KEY ("interview_session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_graphs" ADD CONSTRAINT "task_graphs_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_graphs" ADD CONSTRAINT "task_graphs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_project_id_idx" ON "activity_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "activity_log_event_type_idx" ON "activity_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_log_project_created_idx" ON "activity_log" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_snapshots_project_id_idx" ON "project_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_snapshots_project_version_unique" ON "project_snapshots" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "project_snapshots_parent_idx" ON "project_snapshots" USING btree ("parent_snapshot_id");--> statement-breakpoint
CREATE INDEX "task_graphs_plan_id_idx" ON "task_graphs" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "task_graphs_project_id_idx" ON "task_graphs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_graphs_plan_version_unique" ON "task_graphs" USING btree ("plan_id","graph_version");