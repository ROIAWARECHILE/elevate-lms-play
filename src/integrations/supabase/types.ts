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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
          sort_order: number
          xp_reward: number
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          icon?: string
          id: string
          name: string
          requirement_type: string
          requirement_value?: number
          sort_order?: number
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
          sort_order?: number
          xp_reward?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_dictionary: {
        Row: {
          company_id: string
          course_id: string
          created_at: string
          definition: string
          example: string | null
          id: string
          lesson_id: string
          term: string
          updated_at: string
        }
        Insert: {
          company_id: string
          course_id: string
          created_at?: string
          definition: string
          example?: string | null
          id?: string
          lesson_id: string
          term: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          course_id?: string
          created_at?: string
          definition?: string
          example?: string | null
          id?: string
          lesson_id?: string
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_sources: {
        Row: {
          company_id: string
          course_id: string
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          name: string
        }
        Insert: {
          company_id: string
          course_id: string
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          name: string
        }
        Update: {
          company_id?: string
          course_id?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          company_id: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          is_mandatory: boolean
          level: Database["public"]["Enums"]["course_level"]
          source_brief: Json | null
          status: Database["public"]["Enums"]["course_status"]
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          company_id: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_mandatory?: boolean
          level?: Database["public"]["Enums"]["course_level"]
          source_brief?: Json | null
          status?: Database["public"]["Enums"]["course_status"]
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          company_id?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_mandatory?: boolean
          level?: Database["public"]["Enums"]["course_level"]
          source_brief?: Json | null
          status?: Database["public"]["Enums"]["course_status"]
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_quests: {
        Row: {
          claimed: boolean
          company_id: string
          created_at: string
          current_value: number
          id: string
          quest_date: string
          quest_type: string
          target_value: number
          user_id: string
          xp_reward: number
        }
        Insert: {
          claimed?: boolean
          company_id: string
          created_at?: string
          current_value?: number
          id?: string
          quest_date?: string
          quest_type: string
          target_value: number
          user_id: string
          xp_reward?: number
        }
        Update: {
          claimed?: boolean
          company_id?: string
          created_at?: string
          current_value?: number
          id?: string
          quest_date?: string
          quest_type?: string
          target_value?: number
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: Json | null
          content_type: string
          created_at: string
          id: string
          lesson_type: string
          module_id: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          content?: Json | null
          content_type?: string
          created_at?: string
          id?: string
          lesson_type?: string
          module_id: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          content?: Json | null
          content_type?: string
          created_at?: string
          id?: string
          lesson_type?: string
          module_id?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          current_streak: number
          department: string | null
          full_name: string
          id: string
          job_title: string | null
          last_activity_date: string | null
          level: number
          longest_streak: number
          status: string
          updated_at: string
          xp_total: number
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          current_streak?: number
          department?: string | null
          full_name?: string
          id: string
          job_title?: string | null
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          status?: string
          updated_at?: string
          xp_total?: number
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          current_streak?: number
          department?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          status?: string
          updated_at?: string
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          options: Json
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          sort_order: number
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          options?: Json
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          sort_order?: number
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          options?: Json
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          max_attempts: number
          module_id: string
          passing_score: number
          title: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_attempts?: number
          module_id: string
          passing_score?: number
          title?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          id?: string
          max_attempts?: number
          module_id?: string
          passing_score?: number
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          company_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          company_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          company_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mistakes: {
        Row: {
          block_type: string
          company_id: string
          correct_answer: string
          course_id: string | null
          created_at: string
          explanation: string | null
          id: string
          last_failed_at: string
          last_reviewed_at: string | null
          lesson_id: string | null
          mastered: boolean
          question: string
          times_failed: number
          times_reviewed: number
          user_answer: string | null
          user_id: string
        }
        Insert: {
          block_type: string
          company_id: string
          correct_answer: string
          course_id?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          last_failed_at?: string
          last_reviewed_at?: string | null
          lesson_id?: string | null
          mastered?: boolean
          question: string
          times_failed?: number
          times_reviewed?: number
          user_answer?: string | null
          user_id: string
        }
        Update: {
          block_type?: string
          company_id?: string
          correct_answer?: string
          course_id?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          last_failed_at?: string
          last_reviewed_at?: string | null
          lesson_id?: string | null
          mastered?: boolean
          question?: string
          times_failed?: number
          times_reviewed?: number
          user_answer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          company_id: string
          completed: boolean
          completed_at: string | null
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          module_id: string | null
          quiz_id: string | null
          score: number | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          company_id: string
          completed?: boolean
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          quiz_id?: string | null
          score?: number | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          company_id?: string
          completed?: boolean
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          quiz_id?: string | null
          score?: number | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_xp_log: {
        Row: {
          company_id: string
          created_at: string
          id: string
          source: string
          source_id: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          source: string
          source_id?: string | null
          user_id: string
          xp_amount: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          source?: string
          source_id?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_xp_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: { Args: { _target_user_id: string }; Returns: undefined }
      create_company_for_user: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      ensure_daily_quests: {
        Args: never
        Returns: {
          claimed: boolean
          company_id: string
          created_at: string
          current_value: number
          id: string
          quest_date: string
          quest_type: string
          target_value: number
          user_id: string
          xp_reward: number
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_quests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ensure_user_profile: { Args: { _full_name?: string }; Returns: undefined }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_quest_progress: {
        Args: { _amount?: number; _quest_type: string }
        Returns: undefined
      }
      join_company_by_code: { Args: { _code: string }; Returns: string }
      join_company_by_slug: { Args: { _slug: string }; Returns: string }
      reject_user: { Args: { _target_user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "collaborator"
      course_level: "beginner" | "intermediate" | "advanced"
      course_status: "draft" | "published" | "archived"
      question_type: "multiple_choice" | "true_false"
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
      app_role: ["admin", "collaborator"],
      course_level: ["beginner", "intermediate", "advanced"],
      course_status: ["draft", "published", "archived"],
      question_type: ["multiple_choice", "true_false"],
    },
  },
} as const
