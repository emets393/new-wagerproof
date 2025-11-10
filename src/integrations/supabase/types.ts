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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      angels_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: number
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: number
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      arizona_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      athletics_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      atlanta_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      baltimore_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      boston_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string | null
          id: string
          message_count: number | null
          openai_thread_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_count?: number | null
          openai_thread_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_count?: number | null
          openai_thread_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_pick_votes: {
        Row: {
          created_at: string
          id: string
          pick_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          pick_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          pick_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_pick_votes_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: false
            referencedRelation: "community_picks"
            referencedColumns: ["id"]
          },
        ]
      }
      community_picks: {
        Row: {
          created_at: string
          downvotes: number
          game_date: string
          game_id: string | null
          id: string
          is_locked: boolean
          is_native_pick: boolean
          opponent_team: string | null
          outcome: string | null
          pick_details: string
          pick_type: string
          reasoning: string | null
          sport: string
          team_name: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          downvotes?: number
          game_date: string
          game_id?: string | null
          id?: string
          is_locked?: boolean
          is_native_pick?: boolean
          opponent_team?: string | null
          outcome?: string | null
          pick_details: string
          pick_type: string
          reasoning?: string | null
          sport: string
          team_name: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          created_at?: string
          downvotes?: number
          game_date?: string
          game_id?: string | null
          id?: string
          is_locked?: boolean
          is_native_pick?: boolean
          opponent_team?: string | null
          outcome?: string | null
          pick_details?: string
          pick_type?: string
          reasoning?: string | null
          sport?: string
          team_name?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      cincinnati_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      circa_lines: {
        Row: {
          Away_Team: string | null
          Bets_Away: number | null
          Bets_Home: number | null
          circa_ml_prediction: string | null
          circa_ml_prediction_strength: string | null
          circa_rl_prediction: string | null
          circa_rl_prediction_strength: string | null
          circa_total_prediction: string | null
          circa_total_prediction_strength: string | null
          date: string | null
          Handle_Away: number | null
          Handle_Home: number | null
          Home_Team: string | null
          Money_Away: number | null
          Money_Home: number | null
          RL_Away: number | null
          RL_Bets_Away: number | null
          RL_Bets_Home: number | null
          RL_Handle_Away: number | null
          RL_Handle_Home: number | null
          RL_Home: number | null
          Total_Over_Bets: number | null
          Total_Over_Handle: number | null
          Total_Under_Bets: number | null
          Total_Under_Handle: number | null
          unique_id: string
        }
        Insert: {
          Away_Team?: string | null
          Bets_Away?: number | null
          Bets_Home?: number | null
          circa_ml_prediction?: string | null
          circa_ml_prediction_strength?: string | null
          circa_rl_prediction?: string | null
          circa_rl_prediction_strength?: string | null
          circa_total_prediction?: string | null
          circa_total_prediction_strength?: string | null
          date?: string | null
          Handle_Away?: number | null
          Handle_Home?: number | null
          Home_Team?: string | null
          Money_Away?: number | null
          Money_Home?: number | null
          RL_Away?: number | null
          RL_Bets_Away?: number | null
          RL_Bets_Home?: number | null
          RL_Handle_Away?: number | null
          RL_Handle_Home?: number | null
          RL_Home?: number | null
          Total_Over_Bets?: number | null
          Total_Over_Handle?: number | null
          Total_Under_Bets?: number | null
          Total_Under_Handle?: number | null
          unique_id: string
        }
        Update: {
          Away_Team?: string | null
          Bets_Away?: number | null
          Bets_Home?: number | null
          circa_ml_prediction?: string | null
          circa_ml_prediction_strength?: string | null
          circa_rl_prediction?: string | null
          circa_rl_prediction_strength?: string | null
          circa_total_prediction?: string | null
          circa_total_prediction_strength?: string | null
          date?: string | null
          Handle_Away?: number | null
          Handle_Home?: number | null
          Home_Team?: string | null
          Money_Away?: number | null
          Money_Home?: number | null
          RL_Away?: number | null
          RL_Bets_Away?: number | null
          RL_Bets_Home?: number | null
          RL_Handle_Away?: number | null
          RL_Handle_Home?: number | null
          RL_Home?: number | null
          Total_Over_Bets?: number | null
          Total_Over_Handle?: number | null
          Total_Under_Bets?: number | null
          Total_Under_Handle?: number | null
          unique_id?: string
        }
        Relationships: []
      }
      cleveland_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      colorado_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      cubs_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      custom_models: {
        Row: {
          created_at: string
          model_id: string
          model_name: string
          selected_features: string[]
          target: string
        }
        Insert: {
          created_at?: string
          model_id?: string
          model_name: string
          selected_features: string[]
          target: string
        }
        Update: {
          created_at?: string
          model_id?: string
          model_name?: string
          selected_features?: string[]
          target?: string
        }
        Relationships: []
      }
      detroit_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      dodgers_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      draftkings_lines: {
        Row: {
          away_team: string | null
          bets_away: number | null
          bets_home: number | null
          date: string | null
          handle_away: number | null
          handle_home: number | null
          home_team: string | null
          import_time: string | null
          money_away: number | null
          money_home: number | null
          o_u_line: number | null
          ou_bets_over: number | null
          ou_handle_over: number | null
          rl_away: number | null
          rl_bets_away: number | null
          rl_bets_home: number | null
          rl_handle_away: number | null
          rl_handle_home: number | null
          rl_home: number | null
          unique_id: string
        }
        Insert: {
          away_team?: string | null
          bets_away?: number | null
          bets_home?: number | null
          date?: string | null
          handle_away?: number | null
          handle_home?: number | null
          home_team?: string | null
          import_time?: string | null
          money_away?: number | null
          money_home?: number | null
          o_u_line?: number | null
          ou_bets_over?: number | null
          ou_handle_over?: number | null
          rl_away?: number | null
          rl_bets_away?: number | null
          rl_bets_home?: number | null
          rl_handle_away?: number | null
          rl_handle_home?: number | null
          rl_home?: number | null
          unique_id: string
        }
        Update: {
          away_team?: string | null
          bets_away?: number | null
          bets_home?: number | null
          date?: string | null
          handle_away?: number | null
          handle_home?: number | null
          home_team?: string | null
          import_time?: string | null
          money_away?: number | null
          money_home?: number | null
          o_u_line?: number | null
          ou_bets_over?: number | null
          ou_handle_over?: number | null
          rl_away?: number | null
          rl_bets_away?: number | null
          rl_bets_home?: number | null
          rl_handle_away?: number | null
          rl_handle_home?: number | null
          rl_home?: number | null
          unique_id?: string
        }
        Relationships: []
      }
      editors_picks: {
        Row: {
          created_at: string | null
          editor_id: string
          editors_notes: string | null
          game_id: string
          game_type: string
          id: string
          is_published: boolean | null
          selected_bet_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          editor_id: string
          editors_notes?: string | null
          game_id: string
          game_type: string
          id?: string
          is_published?: boolean | null
          selected_bet_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          editor_id?: string
          editors_notes?: string | null
          game_id?: string
          game_type?: string
          id?: string
          is_published?: boolean | null
          selected_bet_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      feature_request_votes: {
        Row: {
          created_at: string
          feature_request_id: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          feature_request_id: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          feature_request_id?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_request_votes_feature_request_id_fkey"
            columns: ["feature_request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          created_at: string
          description: string
          downvotes: number
          id: string
          roadmap_status: string | null
          status: string
          submitted_by: string
          submitter_display_name: string
          title: string
          updated_at: string
          upvotes: number
        }
        Insert: {
          created_at?: string
          description: string
          downvotes?: number
          id?: string
          roadmap_status?: string | null
          status?: string
          submitted_by: string
          submitter_display_name: string
          title: string
          updated_at?: string
          upvotes?: number
        }
        Update: {
          created_at?: string
          description?: string
          downvotes?: number
          id?: string
          roadmap_status?: string | null
          status?: string
          submitted_by?: string
          submitter_display_name?: string
          title?: string
          updated_at?: string
          upvotes?: number
        }
        Relationships: []
      }
      houston_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      kansas_city_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      live_scores: {
        Row: {
          away_abbr: string
          away_color: string | null
          away_score: number
          away_team: string
          created_at: string | null
          game_id: string
          home_abbr: string
          home_color: string | null
          home_score: number
          home_team: string
          id: string
          is_live: boolean | null
          last_updated: string | null
          league: string
          period: string | null
          status: string
          time_remaining: string | null
        }
        Insert: {
          away_abbr: string
          away_color?: string | null
          away_score: number
          away_team: string
          created_at?: string | null
          game_id: string
          home_abbr: string
          home_color?: string | null
          home_score: number
          home_team: string
          id?: string
          is_live?: boolean | null
          last_updated?: string | null
          league: string
          period?: string | null
          status: string
          time_remaining?: string | null
        }
        Update: {
          away_abbr?: string
          away_color?: string | null
          away_score?: number
          away_team?: string
          created_at?: string | null
          game_id?: string
          home_abbr?: string
          home_color?: string | null
          home_score?: number
          home_team?: string
          id?: string
          is_live?: boolean | null
          last_updated?: string | null
          league?: string
          period?: string | null
          status?: string
          time_remaining?: string | null
        }
        Relationships: []
      }
      mets_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      miami_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      milwaukee_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      minnesota_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      MLB_Teams: {
        Row: {
          division_number: number | null
          full_name: string | null
          latitude: number | null
          league_number: number | null
          longitude: number | null
          short_name: string | null
          team_number: number | null
          TeamRankingsName: string | null
        }
        Insert: {
          division_number?: number | null
          full_name?: string | null
          latitude?: number | null
          league_number?: number | null
          longitude?: number | null
          short_name?: string | null
          team_number?: number | null
          TeamRankingsName?: string | null
        }
        Update: {
          division_number?: number | null
          full_name?: string | null
          latitude?: number | null
          league_number?: number | null
          longitude?: number | null
          short_name?: string | null
          team_number?: number | null
          TeamRankingsName?: string | null
        }
        Relationships: []
      }
      pattern_daily_matches: {
        Row: {
          created_at: string | null
          id: string
          is_home_game: boolean
          match_date: string
          opponent_ml: number | null
          opponent_rl: number | null
          opponent_team: string
          ou_result: number | null
          primary_ml: number | null
          primary_rl: number | null
          primary_runline_win: number | null
          primary_team: string
          primary_win: number | null
          saved_pattern_id: string | null
          unique_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_home_game: boolean
          match_date: string
          opponent_ml?: number | null
          opponent_rl?: number | null
          opponent_team: string
          ou_result?: number | null
          primary_ml?: number | null
          primary_rl?: number | null
          primary_runline_win?: number | null
          primary_team: string
          primary_win?: number | null
          saved_pattern_id?: string | null
          unique_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_home_game?: boolean
          match_date?: string
          opponent_ml?: number | null
          opponent_rl?: number | null
          opponent_team?: string
          ou_result?: number | null
          primary_ml?: number | null
          primary_rl?: number | null
          primary_runline_win?: number | null
          primary_team?: string
          primary_win?: number | null
          saved_pattern_id?: string | null
          unique_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_daily_matches_saved_pattern_id_fkey"
            columns: ["saved_pattern_id"]
            isOneToOne: false
            referencedRelation: "saved_trend_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_roi: {
        Row: {
          created_at: string | null
          id: string
          last_updated: string | null
          losses: number | null
          roi_percentage: number | null
          saved_pattern_id: string | null
          total_bet_amount: number | null
          total_games: number | null
          total_payout: number | null
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          losses?: number | null
          roi_percentage?: number | null
          saved_pattern_id?: string | null
          total_bet_amount?: number | null
          total_games?: number | null
          total_payout?: number | null
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          losses?: number | null
          roi_percentage?: number | null
          saved_pattern_id?: string | null
          total_bet_amount?: number | null
          total_games?: number | null
          total_payout?: number | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_roi_saved_pattern_id_fkey"
            columns: ["saved_pattern_id"]
            isOneToOne: true
            referencedRelation: "saved_trend_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      philadelphia_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      pitcher_ids: {
        Row: {
          pitcher_id: number | null
          pitcher_name: string
        }
        Insert: {
          pitcher_id?: number | null
          pitcher_name: string
        }
        Update: {
          pitcher_id?: number | null
          pitcher_name?: string
        }
        Relationships: []
      }
      pitching_data_today: {
        Row: {
          away_era: string | null
          away_handedness: string | null
          away_pitcher: string | null
          away_pitcher_id: number | null
          away_team: string | null
          away_whip: string | null
          date: string | null
          doubleheader_game: number | null
          home_era: string | null
          home_handedness: string | null
          home_pitcher: string | null
          home_pitcher_id: number | null
          home_team: string | null
          home_whip: string | null
          start_time_et: string | null
          unique_id: string
        }
        Insert: {
          away_era?: string | null
          away_handedness?: string | null
          away_pitcher?: string | null
          away_pitcher_id?: number | null
          away_team?: string | null
          away_whip?: string | null
          date?: string | null
          doubleheader_game?: number | null
          home_era?: string | null
          home_handedness?: string | null
          home_pitcher?: string | null
          home_pitcher_id?: number | null
          home_team?: string | null
          home_whip?: string | null
          start_time_et?: string | null
          unique_id: string
        }
        Update: {
          away_era?: string | null
          away_handedness?: string | null
          away_pitcher?: string | null
          away_pitcher_id?: number | null
          away_team?: string | null
          away_whip?: string | null
          date?: string | null
          doubleheader_game?: number | null
          home_era?: string | null
          home_handedness?: string | null
          home_pitcher?: string | null
          home_pitcher_id?: number | null
          home_team?: string | null
          home_whip?: string | null
          start_time_et?: string | null
          unique_id?: string
        }
        Relationships: []
      }
      pittsburgh_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      polymarket_markets: {
        Row: {
          away_team: string
          created_at: string
          current_away_odds: number
          current_home_odds: number
          game_key: string
          home_team: string
          id: string
          last_updated: string
          league: string
          market_type: string
          price_history: Json
          question: string | null
          token_id: string
        }
        Insert: {
          away_team: string
          created_at?: string
          current_away_odds: number
          current_home_odds: number
          game_key: string
          home_team: string
          id?: string
          last_updated?: string
          league: string
          market_type: string
          price_history: Json
          question?: string | null
          token_id: string
        }
        Update: {
          away_team?: string
          created_at?: string
          current_away_odds?: number
          current_home_odds?: number
          game_key?: string
          home_team?: string
          id?: string
          last_updated?: string
          league?: string
          market_type?: string
          price_history?: Json
          question?: string | null
          token_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          onboarding_data: Json | null
          revenuecat_customer_id: string | null
          subscription_active: boolean | null
          subscription_expires_at: string | null
          subscription_status: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          onboarding_data?: Json | null
          revenuecat_customer_id?: string | null
          subscription_active?: boolean | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          onboarding_data?: Json | null
          revenuecat_customer_id?: string | null
          subscription_active?: boolean | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      san_diego_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      san_francisco_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      saved_trend_patterns: {
        Row: {
          combo: string
          created_at: string | null
          dominant_side: string | null
          feature_count: number
          features: string[]
          games: number
          id: string
          opponent_win_pct: number
          orientation_unique_id: string | null
          pattern_name: string
          target: string
          updated_at: string | null
          user_id: string | null
          win_pct: number
        }
        Insert: {
          combo: string
          created_at?: string | null
          dominant_side?: string | null
          feature_count: number
          features: string[]
          games: number
          id?: string
          opponent_win_pct: number
          orientation_unique_id?: string | null
          pattern_name: string
          target: string
          updated_at?: string | null
          user_id?: string | null
          win_pct: number
        }
        Update: {
          combo?: string
          created_at?: string | null
          dominant_side?: string | null
          feature_count?: number
          features?: string[]
          games?: number
          id?: string
          opponent_win_pct?: number
          orientation_unique_id?: string | null
          pattern_name?: string
          target?: string
          updated_at?: string | null
          user_id?: string | null
          win_pct?: number
        }
        Relationships: []
      }
      seattle_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          access_restricted: boolean | null
          announcement_message: string | null
          announcement_published: boolean | null
          announcement_updated_at: string | null
          announcement_updated_by: string | null
          id: string
          launch_mode: boolean | null
          require_subscription: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          access_restricted?: boolean | null
          announcement_message?: string | null
          announcement_published?: boolean | null
          announcement_updated_at?: string | null
          announcement_updated_by?: string | null
          id?: string
          launch_mode?: boolean | null
          require_subscription?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          access_restricted?: boolean | null
          announcement_message?: string | null
          announcement_published?: boolean | null
          announcement_updated_at?: string | null
          announcement_updated_by?: string | null
          id?: string
          launch_mode?: boolean | null
          require_subscription?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      st_louis_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      tampa_bay_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      teamrankings_ops_last3: {
        Row: {
          ops_last_3: number | null
          team: string
        }
        Insert: {
          ops_last_3?: number | null
          team: string
        }
        Update: {
          ops_last_3?: number | null
          team?: string
        }
        Relationships: []
      }
      teamrankings_team_last3: {
        Row: {
          team: string
          team_last_3: number | null
        }
        Insert: {
          team: string
          team_last_3?: number | null
        }
        Update: {
          team?: string
          team_last_3?: number | null
        }
        Relationships: []
      }
      teamrankings_win_pct: {
        Row: {
          team: string
          win_pct: number | null
        }
        Insert: {
          team: string
          win_pct?: number | null
        }
        Update: {
          team?: string
          win_pct?: number | null
        }
        Relationships: []
      }
      texas_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      toronto_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      training_data: {
        Row: {
          away_division_number: number | null
          away_era: number | null
          away_handedness: number | null
          away_last_runs: number | null
          away_last_runs_allowed: number | null
          away_last_win: number | null
          away_league_number: number | null
          away_ml: number | null
          away_ml_bets: number | null
          away_ml_handle: number | null
          away_ops_last_3: number | null
          away_pitcher: string | null
          away_pitcher_id: number | null
          away_rl: number | null
          away_rl_bets: number | null
          away_rl_handle: number | null
          away_score: string | null
          away_streak: number | null
          away_team: string | null
          away_team_last_3: number | null
          away_team_number: number | null
          away_whip: number | null
          away_win_pct: number | null
          data_source: string | null
          date: string | null
          day: number | null
          ha_winner: number | null
          home_division_number: number | null
          home_era: number | null
          home_handedness: number | null
          home_last_runs: number | null
          home_last_runs_allowed: number | null
          home_last_win: number | null
          home_league_number: number | null
          home_ml: number | null
          home_ml_bets: number | null
          home_ml_handle: number | null
          home_ops_last_3: number | null
          home_pitcher: string | null
          home_pitcher_id: number | null
          home_rl: number | null
          home_rl_bets: number | null
          home_rl_handle: number | null
          home_score: number | null
          home_team: string | null
          home_team_last_3: number | null
          home_team_number: number | null
          home_whip: number | null
          home_win_pct: number | null
          month: number | null
          o_u_line: number | null
          ou_bets_over: number | null
          ou_handle_over: number | null
          ou_result: number | null
          run_line_winner: number | null
          same_division: number | null
          same_league: number | null
          season: number | null
          series_away_wins: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_overs: number | null
          series_unders: number | null
          start_time_minutes: number | null
          streak: number | null
          unique_away_team_id: string | null
          unique_home_team_id: string | null
          unique_id: string
        }
        Insert: {
          away_division_number?: number | null
          away_era?: number | null
          away_handedness?: number | null
          away_last_runs?: number | null
          away_last_runs_allowed?: number | null
          away_last_win?: number | null
          away_league_number?: number | null
          away_ml?: number | null
          away_ml_bets?: number | null
          away_ml_handle?: number | null
          away_ops_last_3?: number | null
          away_pitcher?: string | null
          away_pitcher_id?: number | null
          away_rl?: number | null
          away_rl_bets?: number | null
          away_rl_handle?: number | null
          away_score?: string | null
          away_streak?: number | null
          away_team?: string | null
          away_team_last_3?: number | null
          away_team_number?: number | null
          away_whip?: number | null
          away_win_pct?: number | null
          data_source?: string | null
          date?: string | null
          day?: number | null
          ha_winner?: number | null
          home_division_number?: number | null
          home_era?: number | null
          home_handedness?: number | null
          home_last_runs?: number | null
          home_last_runs_allowed?: number | null
          home_last_win?: number | null
          home_league_number?: number | null
          home_ml?: number | null
          home_ml_bets?: number | null
          home_ml_handle?: number | null
          home_ops_last_3?: number | null
          home_pitcher?: string | null
          home_pitcher_id?: number | null
          home_rl?: number | null
          home_rl_bets?: number | null
          home_rl_handle?: number | null
          home_score?: number | null
          home_team?: string | null
          home_team_last_3?: number | null
          home_team_number?: number | null
          home_whip?: number | null
          home_win_pct?: number | null
          month?: number | null
          o_u_line?: number | null
          ou_bets_over?: number | null
          ou_handle_over?: number | null
          ou_result?: number | null
          run_line_winner?: number | null
          same_division?: number | null
          same_league?: number | null
          season?: number | null
          series_away_wins?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_overs?: number | null
          series_unders?: number | null
          start_time_minutes?: number | null
          streak?: number | null
          unique_away_team_id?: string | null
          unique_home_team_id?: string | null
          unique_id: string
        }
        Update: {
          away_division_number?: number | null
          away_era?: number | null
          away_handedness?: number | null
          away_last_runs?: number | null
          away_last_runs_allowed?: number | null
          away_last_win?: number | null
          away_league_number?: number | null
          away_ml?: number | null
          away_ml_bets?: number | null
          away_ml_handle?: number | null
          away_ops_last_3?: number | null
          away_pitcher?: string | null
          away_pitcher_id?: number | null
          away_rl?: number | null
          away_rl_bets?: number | null
          away_rl_handle?: number | null
          away_score?: string | null
          away_streak?: number | null
          away_team?: string | null
          away_team_last_3?: number | null
          away_team_number?: number | null
          away_whip?: number | null
          away_win_pct?: number | null
          data_source?: string | null
          date?: string | null
          day?: number | null
          ha_winner?: number | null
          home_division_number?: number | null
          home_era?: number | null
          home_handedness?: number | null
          home_last_runs?: number | null
          home_last_runs_allowed?: number | null
          home_last_win?: number | null
          home_league_number?: number | null
          home_ml?: number | null
          home_ml_bets?: number | null
          home_ml_handle?: number | null
          home_ops_last_3?: number | null
          home_pitcher?: string | null
          home_pitcher_id?: number | null
          home_rl?: number | null
          home_rl_bets?: number | null
          home_rl_handle?: number | null
          home_score?: number | null
          home_team?: string | null
          home_team_last_3?: number | null
          home_team_number?: number | null
          home_whip?: number | null
          home_win_pct?: number | null
          month?: number | null
          o_u_line?: number | null
          ou_bets_over?: number | null
          ou_handle_over?: number | null
          ou_result?: number | null
          run_line_winner?: number | null
          same_division?: number | null
          same_league?: number | null
          season?: number | null
          series_away_wins?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_overs?: number | null
          series_unders?: number | null
          start_time_minutes?: number | null
          streak?: number | null
          unique_away_team_id?: string | null
          unique_home_team_id?: string | null
          unique_id?: string
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
      washington_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      white_sox_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      yankees_games: {
        Row: {
          date: string | null
          days_between_games: number | null
          excel_date: number | null
          is_playoff: boolean | null
          join_table_string: string | null
          last_runs: number | null
          last_runs_allowed: number | null
          last_win: number | null
          opponent: string | null
          opponent_score: number | null
          ou_result: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_id: string | null
          series_overs: number | null
          series_unders: number | null
          streak: number | null
          team: string | null
          team_score: number | null
          travel_distance_miles: number | null
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
          days_between_games?: number | null
          excel_date?: number | null
          is_playoff?: boolean | null
          join_table_string?: string | null
          last_runs?: number | null
          last_runs_allowed?: number | null
          last_win?: number | null
          opponent?: string | null
          opponent_score?: number | null
          ou_result?: number | null
          series_game_number?: number | null
          series_home_wins?: number | null
          series_id?: string | null
          series_overs?: number | null
          series_unders?: number | null
          streak?: number | null
          team?: string | null
          team_score?: number | null
          travel_distance_miles?: number | null
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      input_values_team_format_view: {
        Row: {
          date: string | null
          day: number | null
          is_home_team: boolean | null
          month: number | null
          o_u_line: number | null
          opponent_era: number | null
          opponent_handedness: number | null
          opponent_last_runs: number | null
          opponent_last_runs_allowed: number | null
          opponent_last_win: number | null
          opponent_ml: number | null
          opponent_ml_bets: number | null
          opponent_ml_handle: number | null
          opponent_ops_last_3: number | null
          opponent_pitcher_id: number | null
          opponent_rl: number | null
          opponent_rl_bets: number | null
          opponent_rl_handle: number | null
          opponent_streak: number | null
          opponent_team: string | null
          opponent_team_last_3: number | null
          opponent_team_number: number | null
          opponent_whip: number | null
          opponent_win_pct: number | null
          ou_bets_over: number | null
          ou_handle_over: number | null
          primary_era: number | null
          primary_handedness: number | null
          primary_last_runs: number | null
          primary_last_runs_allowed: number | null
          primary_last_win: number | null
          primary_ml: number | null
          primary_ml_bets: number | null
          primary_ml_handle: number | null
          primary_ops_last_3: number | null
          primary_pitcher_id: number | null
          primary_rl: number | null
          primary_rl_bets: number | null
          primary_rl_handle: number | null
          primary_streak: number | null
          primary_team: string | null
          primary_team_last_3: number | null
          primary_team_number: number | null
          primary_vs_opponent_id: string | null
          primary_whip: number | null
          primary_win_pct: number | null
          same_division: number | null
          same_league: number | null
          season: number | null
          series_game_number: number | null
          series_overs: number | null
          series_unders: number | null
          team_side: string | null
          unique_id: string | null
        }
        Relationships: []
      }
      input_values_view: {
        Row: {
          away_division_number: number | null
          away_era: number | null
          away_handedness: number | null
          away_last_runs: number | null
          away_last_runs_allowed: number | null
          away_last_win: number | null
          away_league_number: number | null
          away_ml: number | null
          away_ml_bets: number | null
          away_ml_handle: number | null
          away_ops_last_3: number | null
          away_pitcher: string | null
          away_pitcher_id: number | null
          away_rl: number | null
          away_rl_bets: number | null
          away_rl_handle: number | null
          away_streak: number | null
          away_team: string | null
          away_team_last_3: number | null
          away_team_number: number | null
          away_whip: number | null
          away_win_pct: number | null
          date: string | null
          day: number | null
          excel_date: number | null
          home_division_number: number | null
          home_era: number | null
          home_handedness: number | null
          home_last_runs: number | null
          home_last_runs_allowed: number | null
          home_last_win: number | null
          home_league_number: number | null
          home_ml: number | null
          home_ml_bets: number | null
          home_ml_handle: number | null
          home_ops_last_3: number | null
          home_pitcher: string | null
          home_pitcher_id: number | null
          home_rl: number | null
          home_rl_bets: number | null
          home_rl_handle: number | null
          home_team: string | null
          home_team_last_3: number | null
          home_team_number: number | null
          home_whip: number | null
          home_win_pct: number | null
          month: number | null
          o_u_line: number | null
          ou_bets_over: number | null
          ou_handle_over: number | null
          same_division: number | null
          same_league: number | null
          season: number | null
          series_away_wins: number | null
          series_game_number: number | null
          series_home_wins: number | null
          series_overs: number | null
          series_unders: number | null
          start_time_minutes: number | null
          streak: number | null
          unique_away_team_id: string | null
          unique_home_team_id: string | null
          unique_id: string | null
        }
        Relationships: []
      }
      training_data_team_view: {
        Row: {
          data_source: string | null
          date: string | null
          day: number | null
          is_home_team: boolean | null
          month: number | null
          o_u_line: number | null
          opponent_division_number: number | null
          opponent_era: number | null
          opponent_handedness: number | null
          opponent_last_runs: number | null
          opponent_last_runs_allowed: number | null
          opponent_last_win: number | null
          opponent_league_number: number | null
          opponent_ml: number | null
          opponent_ml_bets: number | null
          opponent_ml_handle: number | null
          opponent_ops_last_3: number | null
          opponent_pitcher: string | null
          opponent_pitcher_id: number | null
          opponent_rl: number | null
          opponent_rl_bets: number | null
          opponent_rl_handle: number | null
          opponent_streak: number | null
          opponent_team: string | null
          opponent_team_last_3: number | null
          opponent_team_number: number | null
          opponent_unique_team_id: string | null
          opponent_whip: number | null
          opponent_win_pct: number | null
          ou_bets_over: number | null
          ou_handle_over: number | null
          ou_result: number | null
          primary_division_number: number | null
          primary_era: number | null
          primary_handedness: number | null
          primary_last_runs: number | null
          primary_last_runs_allowed: number | null
          primary_last_win: number | null
          primary_league_number: number | null
          primary_ml: number | null
          primary_ml_bets: number | null
          primary_ml_handle: number | null
          primary_ops_last_3: number | null
          primary_pitcher: string | null
          primary_pitcher_id: number | null
          primary_rl: number | null
          primary_rl_bets: number | null
          primary_rl_handle: number | null
          primary_runline_win: number | null
          primary_streak: number | null
          primary_team: string | null
          primary_team_last_3: number | null
          primary_team_number: number | null
          primary_unique_team_id: string | null
          primary_whip: number | null
          primary_win: number | null
          primary_win_pct: number | null
          same_division: number | null
          same_league: number | null
          season: number | null
          series_game_number: number | null
          series_opponent_wins: number | null
          series_overs: number | null
          series_primary_wins: number | null
          series_unders: number | null
          start_time_minutes: number | null
          unique_id: string | null
        }
        Relationships: []
      }
      training_data_team_with_orientation: {
        Row: {
          data_source: string | null
          date: string | null
          day: number | null
          is_home_team: boolean | null
          month: number | null
          o_u_line: number | null
          opponent_division_number: number | null
          opponent_era: number | null
          opponent_handedness: number | null
          opponent_last_runs: number | null
          opponent_last_runs_allowed: number | null
          opponent_last_win: number | null
          opponent_league_number: number | null
          opponent_ml: number | null
          opponent_ml_bets: number | null
          opponent_ml_handle: number | null
          opponent_ops_last_3: number | null
          opponent_pitcher: string | null
          opponent_pitcher_id: number | null
          opponent_rl: number | null
          opponent_rl_bets: number | null
          opponent_rl_handle: number | null
          opponent_streak: number | null
          opponent_team: string | null
          opponent_team_last_3: number | null
          opponent_team_number: number | null
          opponent_unique_team_id: string | null
          opponent_whip: number | null
          opponent_win_pct: number | null
          orientation_unique_id: string | null
          ou_bets_over: number | null
          ou_handle_over: number | null
          ou_result: number | null
          primary_division_number: number | null
          primary_era: number | null
          primary_handedness: number | null
          primary_last_runs: number | null
          primary_last_runs_allowed: number | null
          primary_last_win: number | null
          primary_league_number: number | null
          primary_ml: number | null
          primary_ml_bets: number | null
          primary_ml_handle: number | null
          primary_ops_last_3: number | null
          primary_pitcher: string | null
          primary_pitcher_id: number | null
          primary_rl: number | null
          primary_rl_bets: number | null
          primary_rl_handle: number | null
          primary_runline_win: number | null
          primary_streak: number | null
          primary_team: string | null
          primary_team_last_3: number | null
          primary_team_number: number | null
          primary_unique_team_id: string | null
          primary_whip: number | null
          primary_win: number | null
          primary_win_pct: number | null
          same_division: number | null
          same_league: number | null
          season: number | null
          series_game_number: number | null
          series_opponent_wins: number | null
          series_overs: number | null
          series_primary_wins: number | null
          series_unders: number | null
          start_time_minutes: number | null
          unique_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_reset_user_password: {
        Args: { new_password: string; user_email: string }
        Returns: string
      }
      bootstrap_reset_password: {
        Args: { new_password?: string; user_email?: string }
        Returns: string
      }
      delete_user_account: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      ensure_admin_user: { Args: { admin_email?: string }; Returns: string }
      execute_raw_sql: { Args: { sql: string }; Returns: undefined }
      get_access_restricted: { Args: never; Returns: boolean }
      get_admin_user_data: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          onboarding_completed: boolean
          revenuecat_customer_id: string
          subscription_active: boolean
          subscription_expires_at: string
          subscription_status: string
          user_id: string
          username: string
        }[]
      }
      get_announcement_banner: { Args: never; Returns: Json }
      get_sale_mode: { Args: never; Returns: Json }
      get_sandbox_mode: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_access_restricted: {
        Args: { restricted: boolean }
        Returns: boolean
      }
      update_announcement_banner: {
        Args: { message: string; published: boolean }
        Returns: Json
      }
      update_sale_mode: {
        Args: { discount_pct?: number; enabled: boolean }
        Returns: Json
      }
      update_sandbox_mode: { Args: { enabled: boolean }; Returns: Json }
      user_has_access: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "free_user"
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
      app_role: ["admin", "user", "free_user"],
    },
  },
} as const
