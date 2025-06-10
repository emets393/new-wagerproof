export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      angels_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      arizona_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      athletics_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      atlanta_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      baltimore_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      boston_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      cincinnati_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      colorado_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      cubs_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      daily_combined_predictions: {
        Row: {
          away_ml: number | null
          away_rl: number | null
          away_team: string | null
          created_at: string | null
          game_date: string | null
          home_ml: number | null
          home_rl: number | null
          home_team: string | null
          id: string
          ml_probability: number | null
          ml_tier_accuracy: number | null
          moneyline_prediction: string | null
          o_u_line: number | null
          ou_prediction: string | null
          ou_probability: number | null
          ou_tier_accuracy: number | null
          run_line_probability: number | null
          run_line_tier_accuracy: number | null
          runline_prediction: string | null
          strong_ml_prediction: string | null
          strong_ou_prediction: string | null
          strong_runline_prediction: string | null
          unique_id: string
        }
        Insert: {
          away_ml?: number | null
          away_rl?: number | null
          away_team?: string | null
          created_at?: string | null
          game_date?: string | null
          home_ml?: number | null
          home_rl?: number | null
          home_team?: string | null
          id?: string
          ml_probability?: number | null
          ml_tier_accuracy?: number | null
          moneyline_prediction?: string | null
          o_u_line?: number | null
          ou_prediction?: string | null
          ou_probability?: number | null
          ou_tier_accuracy?: number | null
          run_line_probability?: number | null
          run_line_tier_accuracy?: number | null
          runline_prediction?: string | null
          strong_ml_prediction?: string | null
          strong_ou_prediction?: string | null
          strong_runline_prediction?: string | null
          unique_id: string
        }
        Update: {
          away_ml?: number | null
          away_rl?: number | null
          away_team?: string | null
          created_at?: string | null
          game_date?: string | null
          home_ml?: number | null
          home_rl?: number | null
          home_team?: string | null
          id?: string
          ml_probability?: number | null
          ml_tier_accuracy?: number | null
          moneyline_prediction?: string | null
          o_u_line?: number | null
          ou_prediction?: string | null
          ou_probability?: number | null
          ou_tier_accuracy?: number | null
          run_line_probability?: number | null
          run_line_tier_accuracy?: number | null
          runline_prediction?: string | null
          strong_ml_prediction?: string | null
          strong_ou_prediction?: string | null
          strong_runline_prediction?: string | null
          unique_id?: string
        }
        Relationships: []
      }
      detroit_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      dodgers_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
      houston_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      kansas_city_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      mets_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      miami_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      milwaukee_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      minnesota_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          league_number: number | null
          short_name: string | null
          team_number: number | null
          TeamRankingsName: string | null
        }
        Insert: {
          division_number?: number | null
          full_name?: string | null
          league_number?: number | null
          short_name?: string | null
          team_number?: number | null
          TeamRankingsName?: string | null
        }
        Update: {
          division_number?: number | null
          full_name?: string | null
          league_number?: number | null
          short_name?: string | null
          team_number?: number | null
          TeamRankingsName?: string | null
        }
        Relationships: []
      }
      philadelphia_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      san_diego_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      san_francisco_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      seattle_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      st_louis_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      tampa_bay_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      toronto_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
      washington_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      white_sox_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
      yankees_games: {
        Row: {
          date: string | null
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
          unique_id: string
          was_home: boolean | null
          win_loss: string | null
        }
        Insert: {
          date?: string | null
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
          unique_id: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Update: {
          date?: string | null
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
          unique_id?: string
          was_home?: boolean | null
          win_loss?: string | null
        }
        Relationships: []
      }
    }
    Views: {
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
      latest_predictions_today: {
        Row: {
          away_ml: number | null
          away_rl: number | null
          away_team: string | null
          created_at: string | null
          game_date: string | null
          home_ml: number | null
          home_rl: number | null
          home_team: string | null
          id: string | null
          ml_probability: number | null
          ml_tier_accuracy: number | null
          moneyline_prediction: string | null
          o_u_line: number | null
          ou_prediction: string | null
          ou_probability: number | null
          ou_tier_accuracy: number | null
          run_line_probability: number | null
          run_line_tier_accuracy: number | null
          runline_prediction: string | null
          strong_ml_prediction: string | null
          strong_ou_prediction: string | null
          strong_runline_prediction: string | null
          unique_id: string | null
        }
        Relationships: []
      }
      latest_predictions_with_circa: {
        Row: {
          away_ml: number | null
          away_rl: number | null
          away_team: string | null
          Bets_Away: number | null
          Bets_Home: number | null
          circa_ml_prediction: string | null
          circa_ml_prediction_strength: string | null
          circa_rl_prediction: string | null
          circa_rl_prediction_strength: string | null
          circa_total_prediction: string | null
          circa_total_prediction_strength: string | null
          created_at: string | null
          game_date: string | null
          Handle_Away: number | null
          Handle_Home: number | null
          home_ml: number | null
          home_rl: number | null
          home_team: string | null
          id: string | null
          ml_probability: number | null
          ml_tier_accuracy: number | null
          moneyline_prediction: string | null
          o_u_line: number | null
          ou_prediction: string | null
          ou_probability: number | null
          ou_tier_accuracy: number | null
          RL_Bets_Away: number | null
          RL_Bets_Home: number | null
          RL_Handle_Away: number | null
          RL_Handle_Home: number | null
          run_line_probability: number | null
          run_line_tier_accuracy: number | null
          runline_prediction: string | null
          strong_ml_prediction: string | null
          strong_ou_prediction: string | null
          strong_runline_prediction: string | null
          Total_Over_Bets: number | null
          Total_Over_Handle: number | null
          Total_Under_Bets: number | null
          Total_Under_Handle: number | null
          unique_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      execute_raw_sql: {
        Args: { sql: string }
        Returns: undefined
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
