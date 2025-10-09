import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

export default function Callback() {
  const { isLoading, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !error) {
      navigate('/');
    }
  }, [isLoading, error, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a2540]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          <p className="text-white/90">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a2540]">
        <div className="text-center space-y-4">
          <p className="text-red-400">Error: {error.message}</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-white text-[#0a2540] rounded hover:bg-white/90"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
