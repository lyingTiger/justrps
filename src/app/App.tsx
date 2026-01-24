import { useState } from 'react';
import { Hand, HandMetal, Scissors } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt:', { email, password, rememberMe });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-[#FF9900] mb-8 tracking-wider">
            REMEMBER<br />RPS
          </h1>
          
         <div className="flex justify-center items-center gap-4 mb-4">
  {/* 바위 (Rock) */}
  <div className="w-20 h-20 rounded-2xl bg-black/50 flex items-center justify-center backdrop-blur-sm overflow-hidden">
    <img src="public/images/rock.png" alt="Rock" className="w-full h-full object-cover" />
  </div>

  {/* 가위 (Scissors) */}
  <div className="w-20 h-20 rounded-2xl bg-black/50 flex items-center justify-center backdrop-blur-sm overflow-hidden">
    <img src="public/images/scissor.png" alt="Scissors" className="w-full h-full object-cover" />
  </div>

  {/* 보 (Paper) */}
  <div className="w-20 h-20 rounded-2xl bg-black/50 flex items-center justify-center backdrop-blur-sm overflow-hidden">
    <img src="public/images/paper.png" alt="Paper" className="w-full h-full object-cover" />
  </div>
</div>
          
          <p className="text-[#FF9900] text-sm mb-8">v1.1.1</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-12 focus:border-[#FF9900] focus:ring-[#FF9900]"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-12 focus:border-[#FF9900] focus:ring-[#FF9900]"
              required
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="border-zinc-700 data-[state=checked]:bg-[#FF9900] data-[state=checked]:border-[#FF9900]"
              />
              <label
                htmlFor="remember"
                className="text-sm text-white cursor-pointer"
              >
                Remember me
              </label>
            </div>
            <button
              type="button"
              className="text-sm text-zinc-400 hover:text-[#FF9900] transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-[#FF9900] hover:bg-[#FF9900]/90 text-black font-bold text-lg tracking-wider transition-all"
          >
            START
          </Button>
        </form>

        {/* Footer Links */}
        <div className="mt-8 space-y-3 text-center">
          <button className="block w-full text-white hover:text-[#FF9900] transition-colors py-2">
            SHOP
          </button>
          <button className="block w-full text-white hover:text-[#FF9900] transition-colors py-2">
            BEST RECORDS
          </button>
          <button className="block w-full text-white hover:text-[#FF9900] transition-colors py-2">
            HOW TO
          </button>
        </div>

        {/* Tagline */}
        <p className="text-center text-white/80 italic mt-8 text-sm">
          We'll do RPS for you
        </p>
      </div>
    </div>
  );
}
