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
      comments: {
        Row: {
          body: string
          created_at: string
          discussion_id: string
          downvotes: number
          id: string
          parent_id: string | null
          upvotes: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          discussion_id: string
          downvotes?: number
          id?: string
          parent_id?: string | null
          upvotes?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          discussion_id?: string
          downvotes?: number
          id?: string
          parent_id?: string | null
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_participants: {
        Row: {
          contest_id: string
          joined_at: string
          penalty: number
          score: number
          user_id: string
        }
        Insert: {
          contest_id: string
          joined_at?: string
          penalty?: number
          score?: number
          user_id: string
        }
        Update: {
          contest_id?: string
          joined_at?: string
          penalty?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_participants_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_problems: {
        Row: {
          contest_id: string
          ordering: number
          points: number
          problem_id: string
        }
        Insert: {
          contest_id: string
          ordering?: number
          points?: number
          problem_id: string
        }
        Update: {
          contest_id?: string
          ordering?: number
          points?: number
          problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_problems_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contest_problems_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      contests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          slug: string
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          slug: string
          start_time: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          slug?: string
          start_time?: string
          title?: string
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          bonus_xp: number
          date: string
          problem_id: string
        }
        Insert: {
          bonus_xp?: number
          date: string
          problem_id: string
        }
        Update: {
          bonus_xp?: number
          date?: string
          problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          body: string
          created_at: string
          downvotes: number
          id: string
          problem_id: string | null
          title: string
          upvotes: number
          user_id: string
          video_url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          downvotes?: number
          id?: string
          problem_id?: string | null
          title: string
          upvotes?: number
          user_id: string
          video_url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          downvotes?: number
          id?: string
          problem_id?: string | null
          title?: string
          upvotes?: number
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discussions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_rooms: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_code: string
          id: string
          language: Database["public"]["Enums"]["code_language"]
          problem_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_code?: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"]
          problem_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_code?: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"]
          problem_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_rooms_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          constraints: string | null
          created_at: string
          created_by: string | null
          description: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          function_signature: string | null
          id: string
          input_format: string | null
          is_published: boolean
          memory_limit_mb: number
          output_format: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          starter_code: Json
          status: Database["public"]["Enums"]["problem_status"]
          tags: string[]
          time_limit_ms: number
          title: string
          updated_at: string
        }
        Insert: {
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          function_signature?: string | null
          id?: string
          input_format?: string | null
          is_published?: boolean
          memory_limit_mb?: number
          output_format?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          starter_code?: Json
          status?: Database["public"]["Enums"]["problem_status"]
          tags?: string[]
          time_limit_ms?: number
          title: string
          updated_at?: string
        }
        Update: {
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          function_signature?: string | null
          id?: string
          input_format?: string | null
          is_published?: boolean
          memory_limit_mb?: number
          output_format?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          starter_code?: Json
          status?: Database["public"]["Enums"]["problem_status"]
          tags?: string[]
          time_limit_ms?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          code: string
          contest_id: string | null
          created_at: string
          error_message: string | null
          id: string
          language: Database["public"]["Enums"]["code_language"]
          memory_kb: number | null
          passed_count: number | null
          problem_id: string
          runtime_ms: number | null
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          total_count: number | null
          user_id: string
        }
        Insert: {
          code: string
          contest_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language: Database["public"]["Enums"]["code_language"]
          memory_kb?: number | null
          passed_count?: number | null
          problem_id: string
          runtime_ms?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          total_count?: number | null
          user_id: string
        }
        Update: {
          code?: string
          contest_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: Database["public"]["Enums"]["code_language"]
          memory_kb?: number | null
          passed_count?: number | null
          problem_id?: string
          runtime_ms?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          total_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          created_at: string
          expected_output: string
          explanation: string | null
          id: string
          input: string
          is_sample: boolean
          ordering: number
          problem_id: string
        }
        Insert: {
          created_at?: string
          expected_output: string
          explanation?: string | null
          id?: string
          input: string
          is_sample?: boolean
          ordering?: number
          problem_id: string
        }
        Update: {
          created_at?: string
          expected_output?: string
          explanation?: string | null
          id?: string
          input?: string
          is_sample?: boolean
          ordering?: number
          problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          last_active_date: string | null
          level: number
          longest_streak: number
          problems_solved: number
          streak: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          problems_solved?: number
          streak?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          problems_solved?: number
          streak?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          target_id: string
          target_type: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          target_id: string
          target_type: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          target_id?: string
          target_type?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      code_language: "cpp" | "java" | "python" | "javascript"
      difficulty: "easy" | "medium" | "hard"
      problem_status: "pending" | "approved" | "rejected"
      submission_status:
        | "pending"
        | "running"
        | "accepted"
        | "wrong_answer"
        | "time_limit_exceeded"
        | "memory_limit_exceeded"
        | "runtime_error"
        | "compilation_error"
        | "internal_error"
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
      app_role: ["admin", "user"],
      code_language: ["cpp", "java", "python", "javascript"],
      difficulty: ["easy", "medium", "hard"],
      problem_status: ["pending", "approved", "rejected"],
      submission_status: [
        "pending",
        "running",
        "accepted",
        "wrong_answer",
        "time_limit_exceeded",
        "memory_limit_exceeded",
        "runtime_error",
        "compilation_error",
        "internal_error",
      ],
    },
  },
} as const
