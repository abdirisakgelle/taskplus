import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI - show splash screen while we try to recover
      return (
        <div id="splash-screen" style={{ 
          position: 'fixed',
          top: '50%',
          left: '50%',
          background: 'white',
          display: 'flex',
          height: '100%',
          width: '100%',
          transform: 'translate(-50%, -50%)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          flexDirection: 'column'
        }}>
          <img alt="Logo" src="/logo-dark-full.png" style={{ height: '10%', marginBottom: '20px' }} />
          <div style={{ textAlign: 'center' }}>
            <p>Loading application...</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
