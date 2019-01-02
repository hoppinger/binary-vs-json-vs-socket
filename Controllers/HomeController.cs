using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Formatters.Binary;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace web_sockets_playground.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }


    public class DataController : Controller
    {
        [HttpGet()]
        public ActionResult<ushort[]> JSON([FromQuery] int requestSize)
        {
            // Console.WriteLine($"Request (JSON) {requestSize}");
            var numbers = Utils.GetNumbers(requestSize);

            return Ok(numbers);
        }

        [HttpGet()]
        public FileStreamResult Numbers([FromQuery] int requestSize)
        {
            var numbers = Utils.GetNumbers(requestSize);

            var ms = new System.IO.MemoryStream();
            var bw = new BinaryWriter(ms);

            bw.Write(numbers.Length);
            foreach (var x in numbers) {
                bw.Write(x);
            }

            bw.Flush();
            ms.Seek(0, SeekOrigin.Begin);

            return new FileStreamResult(ms, "application/octet-stream");
        }
    }
}

