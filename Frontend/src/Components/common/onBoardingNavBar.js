import Link from "next/link";

const OnBoardingNavBar = () => {
  return (
    <nav className="w-full border-b-2 pb-2 border-green-300 px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-4 md:py-5">
      <div className="flex justify-between items-center w-full h-10 sm:h-12 md:h-14">
        {/* Logo - Left side */}
        <div className="flex-shrink-0">
          <Link href="/profile">
            <img 
              src='/Gradus.png' 
              alt="Logo" 
              width={150} 
              height={80}
              className="h-20 sm:h-24 md:h-28 lg:h-32 xl:h-36 w-auto object-contain"
            />
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default OnBoardingNavBar;