export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          chama_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          owner_id: string
          status: string
          target_amount: number
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          chama_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          owner_id: string
          status?: string
          target_amount?: number
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          chama_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          owner_id?: string
          status?: string
          target_amount?: number
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_chama_id_fkey"
            columns: ["chama_id"]
            isOneToOne: false
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_invites: {
        Row: {
          chama_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          token: string
          uses: number
        }
        Insert: {
          chama_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          token: string
          uses?: number
        }
        Update: {
          chama_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          token?: string
          uses?: number
        }
        Relationships: []
      }
      chama_members: {
        Row: {
          chama_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          chama_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          chama_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_members_chama_id_fkey"
            columns: ["chama_id"]
            isOneToOne: false
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamas: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          monthly_target: number | null
          name: string
          search_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          monthly_target?: number | null
          name: string
          search_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          monthly_target?: number | null
          name?: string
          search_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contributions: {
        Row: {
          amount: number
          campaign_id: string | null
          chama_id: string | null
          contributed_at: string
          contributor_id: string | null
          contributor_name: string | null
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          reference: string | null
          source: string
          status: string
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          chama_id?: string | null
          contributed_at?: string
          contributor_id?: string | null
          contributor_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          reference?: string | null
          source?: string
          status?: string
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          chama_id?: string | null
          contributed_at?: string
          contributor_id?: string | null
          contributor_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          reference?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_chama_id_fkey"
            columns: ["chama_id"]
            isOneToOne: false
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          amount: number
          id: string
          loan_id: string
          paid_at: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          id?: string
          loan_id: string
          paid_at?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          id?: string
          loan_id?: string
          paid_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          approved_by: string | null
          balance: number
          borrower_id: string
          chama_id: string
          created_at: string
          due_date: string | null
          id: string
          interest_rate: number
          principal: number
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          balance?: number
          borrower_id: string
          chama_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          interest_rate?: number
          principal: number
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          balance?: number
          borrower_id?: string
          chama_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          interest_rate?: number
          principal?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_chama_id_fkey"
            columns: ["chama_id"]
            isOneToOne: false
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          campaign_id: string | null
          chama_id: string | null
          contribution_id: string | null
          created_at: string
          external_reference: string | null
          id: string
          phone: string
          provider: string
          provider_reference: string | null
          raw_response: Json | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          chama_id?: string | null
          contribution_id?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          phone: string
          provider?: string
          provider_reference?: string | null
          raw_response?: Json | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          chama_id?: string | null
          contribution_id?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          phone?: string
          provider?: string
          provider_reference?: string | null
          raw_response?: Json | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_chama_invite: { Args: { _token: string }; Returns: Json }
      find_chama_by_name: {
        Args: { _name: string }
        Returns: {
          id: string
          member_count: number
          name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chama_member: {
        Args: { _chama_id: string; _user_id: string }
        Returns: boolean
      }
      is_chama_treasurer: {
        Args: { _chama_id: string; _user_id: string }
        Returns: boolean
      }
      join_chama_by_name: { Args: { _name: string }; Returns: Json }
      preview_chama_invite: {
        Args: { _token: string }
        Returns: {
          chama_id: string
          chama_name: string
          expires_at: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "treasurer" | "member" | "campaign_owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "treasurer", "member", "campaign_owner"],
    },
  },
} as const
