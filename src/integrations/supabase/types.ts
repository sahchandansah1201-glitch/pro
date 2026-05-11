export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      assessments: {
        Row: {
          abcd: Json;
          ai_confidence: number | null;
          ai_features: string[];
          ai_risk: Database["public"]["Enums"]["risk_level"] | null;
          ai_uncertainty_notes: string[];
          ai_xai_notes: string;
          clinic_id: string;
          created_at: string;
          decided_at: string;
          decided_by: string | null;
          id: string;
          lesion_id: string;
          seven_point: Json;
          visit_id: string;
        };
        Insert: {
          abcd: Json;
          ai_confidence?: number | null;
          ai_features?: string[];
          ai_risk?: Database["public"]["Enums"]["risk_level"] | null;
          ai_uncertainty_notes?: string[];
          ai_xai_notes?: string;
          clinic_id: string;
          created_at?: string;
          decided_at?: string;
          decided_by?: string | null;
          id?: string;
          lesion_id: string;
          seven_point: Json;
          visit_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessments"]["Insert"]>;
        Relationships: never[];
      };
      assets: {
        Row: {
          captured_at: string;
          clinic_id: string;
          created_at: string;
          device_id: string | null;
          exif: Json;
          id: string;
          kind: Database["public"]["Enums"]["image_kind"];
          lesion_id: string | null;
          quality_issues: string[];
          quality_score: number;
          source: Database["public"]["Enums"]["image_source"];
          storage_object_path: string;
          visit_id: string;
        };
        Insert: {
          captured_at: string;
          clinic_id: string;
          created_at?: string;
          device_id?: string | null;
          exif?: Json;
          id?: string;
          kind: Database["public"]["Enums"]["image_kind"];
          lesion_id?: string | null;
          quality_issues?: string[];
          quality_score: number;
          source: Database["public"]["Enums"]["image_source"];
          storage_object_path: string;
          visit_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
        Relationships: never[];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          clinic_id: string;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
          payload: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          clinic_id: string;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: string;
          payload?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: never[];
      };
      clinics: {
        Row: {
          address: string;
          created_at: string;
          id: string;
          name: string;
          partner_tier: Database["public"]["Enums"]["partner_tier"];
          phone: string;
          routing_priority: number;
        };
        Insert: {
          address: string;
          created_at?: string;
          id?: string;
          name: string;
          partner_tier?: Database["public"]["Enums"]["partner_tier"];
          phone: string;
          routing_priority?: number;
        };
        Update: Partial<Database["public"]["Tables"]["clinics"]["Insert"]>;
        Relationships: never[];
      };
      conclusions: {
        Row: {
          clinic_id: string;
          decided_at: string;
          decided_by: string | null;
          doctor_text: string;
          follow_up_plan: string;
          id: string;
          visit_id: string;
        };
        Insert: {
          clinic_id: string;
          decided_at?: string;
          decided_by?: string | null;
          doctor_text: string;
          follow_up_plan?: string;
          id?: string;
          visit_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["conclusions"]["Insert"]>;
        Relationships: never[];
      };
      consents: {
        Row: {
          clinic_id: string;
          created_at: string;
          granted_at: string | null;
          id: string;
          patient_id: string;
          purpose: Database["public"]["Enums"]["consent_purpose"];
          recorded_by: string | null;
          revoked_at: string | null;
          status: Database["public"]["Enums"]["consent_status"];
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          granted_at?: string | null;
          id?: string;
          patient_id: string;
          purpose: Database["public"]["Enums"]["consent_purpose"];
          recorded_by?: string | null;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["consent_status"];
        };
        Update: Partial<Database["public"]["Tables"]["consents"]["Insert"]>;
        Relationships: never[];
      };
      lesions: {
        Row: {
          body_zone: string;
          clinic_id: string;
          created_at: string;
          first_seen_at: string;
          id: string;
          label: string;
          map_view: string;
          map_x: number;
          map_y: number;
          patient_id: string;
          status: Database["public"]["Enums"]["lesion_status"];
        };
        Insert: {
          body_zone: string;
          clinic_id: string;
          created_at?: string;
          first_seen_at: string;
          id?: string;
          label: string;
          map_view: string;
          map_x: number;
          map_y: number;
          patient_id: string;
          status?: Database["public"]["Enums"]["lesion_status"];
        };
        Update: Partial<Database["public"]["Tables"]["lesions"]["Insert"]>;
        Relationships: never[];
      };
      patient_user_link: {
        Row: {
          granted_at: string;
          id: string;
          patient_id: string;
          revoked_at: string | null;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          id?: string;
          patient_id: string;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_user_link"]["Insert"]>;
        Relationships: never[];
      };
      patients: {
        Row: {
          birth_date: string;
          clinic_id: string;
          code: string;
          created_at: string;
          created_by: string | null;
          full_name: string;
          id: string;
          phototype: Database["public"]["Enums"]["phototype"];
          risk_factors: string[];
          sex: Database["public"]["Enums"]["sex"];
        };
        Insert: {
          birth_date: string;
          clinic_id: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          full_name: string;
          id?: string;
          phototype: Database["public"]["Enums"]["phototype"];
          risk_factors?: string[];
          sex: Database["public"]["Enums"]["sex"];
        };
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
        Relationships: never[];
      };
      profiles: {
        Row: {
          clinic_id: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          locale: string;
        };
        Insert: {
          clinic_id?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          locale?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: never[];
      };
      protected_analysis_links: {
        Row: {
          clinic_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          scope: string;
          token_hash: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          scope?: string;
          token_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["protected_analysis_links"]["Insert"]>;
        Relationships: never[];
      };
      public_signed_links: {
        Row: {
          clinic_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          report_version_id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          report_version_id: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["public_signed_links"]["Insert"]>;
        Relationships: never[];
      };
      report_versions: {
        Row: {
          clinic_id: string;
          created_at: string;
          created_by: string | null;
          doctor_text: string;
          id: string;
          patient_safe_text: string;
          report_id: string;
          signed_at: string | null;
          signed_by: string | null;
          status: Database["public"]["Enums"]["report_version_status"];
          version: number;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          created_by?: string | null;
          doctor_text: string;
          id?: string;
          patient_safe_text: string;
          report_id: string;
          signed_at?: string | null;
          signed_by?: string | null;
          status?: Database["public"]["Enums"]["report_version_status"];
          version: number;
        };
        Update: Partial<Database["public"]["Tables"]["report_versions"]["Insert"]>;
        Relationships: never[];
      };
      reports: {
        Row: {
          clinic_id: string;
          created_at: string;
          current_version_id: string | null;
          id: string;
          visit_id: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          current_version_id?: string | null;
          id?: string;
          visit_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: never[];
      };
      user_roles: {
        Row: {
          clinic_id: string | null;
          granted_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          clinic_id?: string | null;
          granted_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: never[];
      };
      visits: {
        Row: {
          assistant_id: string | null;
          clinic_id: string;
          closed_at: string | null;
          complaint: string;
          created_at: string;
          doctor_id: string | null;
          id: string;
          patient_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["visit_status"];
        };
        Insert: {
          assistant_id?: string | null;
          clinic_id: string;
          closed_at?: string | null;
          complaint?: string;
          created_at?: string;
          doctor_id?: string | null;
          id?: string;
          patient_id: string;
          started_at: string;
          status?: Database["public"]["Enums"]["visit_status"];
        };
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
        Relationships: never[];
      };
    };
    Views: {
      access_events_admin: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_full_name: string | null;
          actor_id: string | null;
          clinic_id: string;
          clinic_name: string;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
          lesion_id: string | null;
          lesion_label: string | null;
          patient_code: string | null;
          patient_full_name: string | null;
          patient_id: string | null;
          payload: Json;
          visit_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: never[];
      };
    };
    Functions: {
      _stage1d_allowed_actions: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      _stage1d_allowed_entities: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      _stage1d_denied_payload_keys: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string };
        Returns: boolean;
      };
      has_stage1c_write_role: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      is_clinic_doctor: {
        Args: { _clinic_id: string; _user_id: string };
        Returns: boolean;
      };
      is_clinic_staff: {
        Args: { _clinic_id: string; _user_id: string };
        Returns: boolean;
      };
      is_linked_patient: {
        Args: { _patient_id: string; _user_id: string };
        Returns: boolean;
      };
      log_clinical_write: {
        Args: {
          _action: string;
          _clinic_id: string;
          _entity: string;
          _entity_id: string;
          _payload?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role:
        | "patient"
        | "doctor"
        | "private_doctor"
        | "assistant"
        | "operator"
        | "clinic_admin"
        | "system_admin";
      consent_purpose:
        | "pdn"
        | "imaging"
        | "ai_processing"
        | "telemed"
        | "share_external"
        | "public_link";
      consent_status: "granted" | "revoked" | "pending";
      image_kind: "overview" | "dermoscopy" | "macro" | "body_map";
      image_source: "phone" | "file" | "camera" | "device_bridge" | "local_transfer";
      lesion_status: "active" | "monitoring" | "removed" | "archived";
      partner_tier: "owned" | "partner" | "external";
      phototype: "I" | "II" | "III" | "IV" | "V" | "VI";
      report_version_status: "draft" | "final" | "amended" | "revoked";
      risk_level: "low" | "moderate" | "high" | "urgent";
      sex: "male" | "female";
      visit_status: "scheduled" | "in_progress" | "closed" | "cancelled";
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;
