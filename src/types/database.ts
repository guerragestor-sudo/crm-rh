
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>,"occurred_at": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"organization_id": string
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_actor_member_id_fkey"
      columns: ["organization_id","actor_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"candidate_documents": {
                  Row: {
                    "candidate_id": string,"created_at": string,"document_type": string,"file_name": string,"id": string,"is_current": boolean,"mime_type": string,"organization_id": string,"size_bytes": number,"storage_path": string,"uploaded_by_member_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"document_type"?: string,"file_name": string,"id"?: string,"is_current"?: boolean,"mime_type": string,"organization_id": string,"size_bytes": number,"storage_path": string,"uploaded_by_member_id"?: string | null
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"document_type"?: string,"file_name"?: string,"id"?: string,"is_current"?: boolean,"mime_type"?: string,"organization_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by_member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidate_documents_organization_id_candidate_id_fkey"
      columns: ["organization_id","candidate_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidate_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "candidate_documents_organization_id_uploaded_by_member_id_fkey"
      columns: ["organization_id","uploaded_by_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"candidate_history": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"candidate_id": string,"created_at": string,"field": string | null,"id": number,"metadata": NonNullable<Json>,"new_value": string | null,"old_value": string | null,"organization_id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"candidate_id": string,"created_at"?: string,"field"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>,"new_value"?: string | null,"old_value"?: string | null,"organization_id": string,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"candidate_id"?: string,"created_at"?: string,"field"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>,"new_value"?: string | null,"old_value"?: string | null,"organization_id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidate_history_organization_id_actor_member_id_fkey"
      columns: ["organization_id","actor_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidate_history_organization_id_candidate_id_fkey"
      columns: ["organization_id","candidate_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidate_history_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"candidate_statuses": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"organization_id": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"position": number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidate_statuses_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"candidates": {
                  Row: {
                    "archived_at": string | null,"archived_by_member_id": string | null,"availability": string | null,"course_notes": string | null,"course_status": string,"cpf": string | null,"created_at": string,"created_by_member_id": string | null,"currently_working": boolean | null,"documentation_notes": string | null,"documentation_status": string,"email": string | null,"full_name": string,"id": string,"integration_date": string | null,"interview_at": string | null,"manager_id": string | null,"notes": string | null,"organization_id": string,"phone": string | null,"region_id": string | null,"responsible_member_id": string,"search_text": string | null,"segment_id": string | null,"sla_days_frozen": number | null,"sla_frozen_at": string | null,"source_id": string | null,"status_changed_at": string,"status_id": string,"updated_at": string,"updated_by_member_id": string | null,"next_task": Json | null,"sla_days": number | null
                  }
                  ComputedFields: "next_task" | "sla_days"
                  Insert: {
                    "archived_at"?: string | null,"archived_by_member_id"?: string | null,"availability"?: string | null,"course_notes"?: string | null,"course_status"?: string,"cpf"?: string | null,"created_at"?: string,"created_by_member_id"?: string | null,"currently_working"?: boolean | null,"documentation_notes"?: string | null,"documentation_status"?: string,"email"?: string | null,"full_name": string,"id"?: string,"integration_date"?: string | null,"interview_at"?: string | null,"manager_id"?: string | null,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"region_id"?: string | null,"responsible_member_id": string,"search_text"?: never,"segment_id"?: string | null,"sla_days_frozen"?: number | null,"sla_frozen_at"?: string | null,"source_id"?: string | null,"status_changed_at"?: string,"status_id": string,"updated_at"?: string,"updated_by_member_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"archived_by_member_id"?: string | null,"availability"?: string | null,"course_notes"?: string | null,"course_status"?: string,"cpf"?: string | null,"created_at"?: string,"created_by_member_id"?: string | null,"currently_working"?: boolean | null,"documentation_notes"?: string | null,"documentation_status"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"integration_date"?: string | null,"interview_at"?: string | null,"manager_id"?: string | null,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"region_id"?: string | null,"responsible_member_id"?: string,"search_text"?: never,"segment_id"?: string | null,"sla_days_frozen"?: number | null,"sla_frozen_at"?: string | null,"source_id"?: string | null,"status_changed_at"?: string,"status_id"?: string,"updated_at"?: string,"updated_by_member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidates_organization_id_archived_by_member_id_fkey"
      columns: ["organization_id","archived_by_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_created_by_member_id_fkey"
      columns: ["organization_id","created_by_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "candidates_organization_id_manager_id_fkey"
      columns: ["organization_id","manager_id"]
isOneToOne: false
      referencedRelation: "managers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_region_id_fkey"
      columns: ["organization_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_responsible_member_id_fkey"
      columns: ["organization_id","responsible_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_segment_id_fkey"
      columns: ["organization_id","segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_source_id_fkey"
      columns: ["organization_id","source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_status_id_fkey"
      columns: ["organization_id","status_id"]
isOneToOne: false
      referencedRelation: "candidate_statuses"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "candidates_organization_id_updated_by_member_id_fkey"
      columns: ["organization_id","updated_by_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"managers": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"is_active": boolean,"name": string,"organization_id": string,"phone": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"phone"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"phone"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "managers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "managers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"role": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"role": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"role"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_settings": {
                  Row: {
                    "created_at": string,"organization_id": string,"sla_target_days": number | null,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organization_id": string,"sla_target_days"?: number | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"organization_id"?: string,"sla_target_days"?: number | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_settings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regions": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"organization_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "regions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"segments": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"organization_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "segments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"sources": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"organization_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sources_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "candidate_id": string,"completed_at": string | null,"completed_by_member_id": string | null,"created_at": string,"created_by_member_id": string | null,"description": string | null,"due_date": string,"due_time": string | null,"external_id": string | null,"id": string,"metadata": NonNullable<Json>,"organization_id": string,"priority": string,"responsible_member_id": string,"status": string,"title": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"completed_at"?: string | null,"completed_by_member_id"?: string | null,"created_at"?: string,"created_by_member_id"?: string | null,"description"?: string | null,"due_date": string,"due_time"?: string | null,"external_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id": string,"priority"?: string,"responsible_member_id": string,"status"?: string,"title": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "candidate_id"?: string,"completed_at"?: string | null,"completed_by_member_id"?: string | null,"created_at"?: string,"created_by_member_id"?: string | null,"description"?: string | null,"due_date"?: string,"due_time"?: string | null,"external_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string,"priority"?: string,"responsible_member_id"?: string,"status"?: string,"title"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_organization_id_candidate_id_fkey"
      columns: ["organization_id","candidate_id"]
isOneToOne: false
      referencedRelation: "candidates"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_completed_by_member_id_fkey"
      columns: ["organization_id","completed_by_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_created_by_member_id_fkey"
      columns: ["organization_id","created_by_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_organization_id_responsible_member_id_fkey"
      columns: ["organization_id","responsible_member_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "app_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"archive_candidate":
{ Args: { "p_candidate_id": string }; Returns: undefined
                           },
"change_candidate_manager":
{ Args: { "p_candidate_id": string,"p_manager_id": string,"p_reason"?: string }; Returns: undefined
                           },
"change_candidate_status":
{ Args: { "p_candidate_id": string,"p_reason"?: string,"p_status_id": string }; Returns: undefined
                           },
"dashboard_summary":
{ Args: { "p_filters"?: Json }; Returns: Json
                           },
"filter_candidates":
{ Args: { "p_filters"?: Json }; Returns: {
              "archived_at": string | null,
"archived_by_member_id": string | null,
"availability": string | null,
"course_notes": string | null,
"course_status": string,
"cpf": string | null,
"created_at": string,
"created_by_member_id": string | null,
"currently_working": boolean | null,
"documentation_notes": string | null,
"documentation_status": string,
"email": string | null,
"full_name": string,
"id": string,
"integration_date": string | null,
"interview_at": string | null,
"manager_id": string | null,
"notes": string | null,
"organization_id": string,
"phone": string | null,
"region_id": string | null,
"responsible_member_id": string,
"search_text": string | null,
"segment_id": string | null,
"sla_days_frozen": number | null,
"sla_frozen_at": string | null,
"source_id": string | null,
"status_changed_at": string,
"status_id": string,
"updated_at": string,
"updated_by_member_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "candidates"
        isOneToOne: false
        isSetofReturn: true
      } },
"find_candidate_duplicates":
{ Args: { "p_cpf"?: string,"p_email"?: string,"p_exclude_id"?: string,"p_phone"?: string }; Returns: {
              "archived": boolean,"full_name": string,"id": string,"match": string,"status_name": string
            }[]
                           },
"log_audit_event":
{ Args: { "p_action": string,"p_entity_id"?: string,"p_entity_type": string,"p_metadata"?: Json }; Returns: undefined
                           },
"next_task":
{ Args: { "c": Omit<Database["public"]['Tables']["candidates"]['Row'], Database["public"]['Tables']["candidates"]['ComputedFields']> }; Returns: Json
                           },
"register_candidate_document":
{ Args: { "p_candidate_id": string,"p_document_type": string,"p_file_name": string,"p_mime_type": string,"p_size_bytes": number,"p_storage_path": string }; Returns: string
                           },
"restore_candidate":
{ Args: { "p_candidate_id": string }; Returns: undefined
                           },
"sla_breakdown":
{ Args: { "p_filters"?: Json,"p_group_by"?: string }; Returns: Json
                           },
"sla_days":
{ Args: { "c": Omit<Database["public"]['Tables']["candidates"]['Row'], Database["public"]['Tables']["candidates"]['ComputedFields']> }; Returns: number
                           },
"swap_status_positions":
{ Args: { "p_first": string,"p_second": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
