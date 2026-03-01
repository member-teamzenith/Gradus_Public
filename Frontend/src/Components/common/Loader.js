import { TailChase } from 'ldrs/react'
import 'ldrs/react/TailChase.css'

function Loader({text, size = "40", speed = "1", color = "white"}) {
    return (
      <div className='flex flex-col items-center justify-center'>
        <TailChase
          size={size}
          speed={speed}
          color={color} 
        />
        {text && <h1 className='text-white text-lg font-semibold mt-3'>{text}</h1>}
      </div>
    );
  }
  
  export default Loader;