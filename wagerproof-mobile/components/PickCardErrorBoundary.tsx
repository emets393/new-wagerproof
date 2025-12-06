import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
  pickId?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for EditorPickCard to prevent
 * crashes on Android when rendering picks with invalid data
 */
export class PickCardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PickCard Error:', error, errorInfo);
    console.error('Pick ID:', this.props.pickId);
  }

  render() {
    if (this.state.hasError) {
      return <PickCardErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function PickCardErrorFallback({ error }: { error?: Error }) {
  const theme = useTheme();

  return (
    <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
      <MaterialCommunityIcons 
        name="alert-circle-outline" 
        size={24} 
        color={theme.colors.error} 
      />
      <Text style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
        Unable to display pick
      </Text>
      {__DEV__ && error && (
        <Text style={[styles.errorDetails, { color: theme.colors.onErrorContainer }]}>
          {error.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  errorDetails: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
});

